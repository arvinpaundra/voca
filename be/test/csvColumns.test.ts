import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect, Exit } from "effect"
import { HttpClientRequest } from "effect/http"
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api"
import { SqlClient } from "effect/sql"
import { Authorization, VocaApi } from "@voca/contract"
import type { ColumnMatch, ImportBatch, ImportBatchSlug } from "@voca/contract"
import { TokenSigner } from "../src/identity/application/ports.ts"
import { at, call, makeIdentityRuntime, seedLearner, testBeanstalk } from "./identity.ts"
import { resetDb } from "./setup.ts"

const rt = makeIdentityRuntime(undefined, { imports: testBeanstalk("csvColumns") })
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-28T00:00:00Z"))))

const signedIn = (slug: string) =>
  Effect.gen(function* () {
    yield* seedLearner(slug)
    const signer = yield* TokenSigner
    return (yield* signer.sign(slug as never)).token
  })

const ownDeck = (slug = "ABCDEFGH") =>
  Effect.gen(function* () {
    const token = yield* signedIn(slug)
    const deck = yield* call(
      (c) => c.library.createDeck({ payload: { title: "N5", termLang: "ja", meaningLang: "id" } }),
      token
    )

    return { token, deckSlug: String(deck.slug) }
  })

const multipartClient = (token: string) =>
  HttpApiMiddleware.layerClient(Authorization, ({ next, request }) =>
    next(
      request.pipe(
        HttpClientRequest.bearerToken(token),
        HttpClientRequest.setHeader("content-type", "multipart/form-data")
      )
    )
  )

const upload = (token: string, deckSlug: string, content: string, columns?: ReadonlyArray<string | null>) => {
  const form = new FormData()

  form.append("file", new Blob([content], { type: "text/csv" }), "words.csv")

  if (columns !== undefined) {
    form.append("columns", JSON.stringify(columns))
  }

  return HttpApiTest.groups(VocaApi, ["library"]).pipe(
    Effect.flatMap((c) => c.library.importCsv({ params: { deckSlug: deckSlug as never }, payload: form })),
    Effect.provide(multipartClient(token)),
    Effect.scoped
  )
}

type CsvFile = readonly [name: string, content: string, columns: ColumnMatch]

const uploadBatch = (token: string, files: ReadonlyArray<CsvFile>, columns = files.map((file) => file[2])) => {
  const form = new FormData()

  form.append("termLang", "ja")
  form.append("meaningLang", "id")

  for (const [name, content] of files) {
    form.append("files", new Blob([content], { type: "text/csv" }), name)
  }

  form.append("columns", JSON.stringify(columns))

  return HttpApiTest.groups(VocaApi, ["imports"]).pipe(
    Effect.flatMap((c) => c.imports.importDecks({ payload: form })),
    Effect.provide(multipartClient(token)),
    Effect.scoped
  )
}

const words = (token: string, deckSlug: string) =>
  Effect.map(
    call((c) => c.library.listWords({ params: { deckSlug: deckSlug as never }, query: { limit: 200 } }), token),
    (page) =>
      page.items
        .map((w) => ({ term: w.term, meaning: w.meaning, reading: w.reading, example: w.example, notes: w.notes }))
        .sort((a, b) => a.term.localeCompare(b.term))
  )

const liveWordCount = (deckSlug: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const [row] = yield* sql<{ readonly n: number }>`
      SELECT count(*)::int AS n FROM words w JOIN decks d ON d.id = w.deck_id
      WHERE d.slug = ${deckSlug} AND w.deleted_at IS NULL`

    return row!.n
  })

const list = (token: string) => call((c) => c.imports.listImports(), token)

const isFinished = (batch: ImportBatch) =>
  batch.files.every((file) => file.status === "done" || file.status === "failed")

const finished = (token: string, slug: ImportBatchSlug) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 300; attempt++) {
      const batch = (yield* list(token)).find((b) => b.slug === slug)

      if (batch !== undefined && isFinished(batch)) {
        return batch
      }

      yield* Effect.promise(() => Bun.sleep(100))
    }

    return yield* Effect.die(`batch ${slug} did not finish in 30 s`)
  })

const deckWords = (token: string, batch: ImportBatch, index: number) =>
  words(token, String(batch.files[index]!.deck!.slug))

const word = (term: string, meaning: string, reading: string | null = null) => ({
  term,
  meaning,
  reading,
  example: null,
  notes: null
})

describe("POST /decks/:deckSlug/import with matched columns", () => {
  test("only the matched columns are imported; a column on Not imported is not stored", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        const csv = "kosakata,arti,cara baca\n食べる,makan,たべる\n水,air,みず\n"

        const result = yield* upload(token, deckSlug, csv, ["term", "meaning", null])

        expect(result).toEqual({ imported: 2, skippedDuplicates: 0 })
        expect(yield* words(token, deckSlug)).toEqual([word("水", "air"), word("食べる", "makan")])
      })
    ))

  test.each(["cara baca", "furigana"])("a column named %s matched to Reading imports as the reading", (name) =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        const csv = `${name},kosakata,arti\nたべる,食べる,makan\n`

        yield* upload(token, deckSlug, csv, ["reading", "term", "meaning"])

        expect(yield* words(token, deckSlug)).toEqual([word("食べる", "makan", "たべる")])
      })
    ))

  test("a value longer than any field limit in a Not imported column causes no error", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        const csv = `kosakata,arti,catatan\n水,air,${"x".repeat(3000)}\n`

        const result = yield* upload(token, deckSlug, csv, ["term", "meaning", null])

        expect(result).toEqual({ imported: 1, skippedDuplicates: 0 })
        expect(yield* words(token, deckSlug)).toEqual([word("水", "air")])
      })
    ))

  test("a column with a blank header can be matched like any other", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        const csv = "kosakata,,arti\n水,みず,air\n"

        yield* upload(token, deckSlug, csv, ["term", "reading", "meaning"])

        expect(yield* words(token, deckSlug)).toEqual([word("水", "air", "みず")])
      })
    ))

  test("a row error names the field, then the Learner's column, and nothing is imported", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        const rows = Array.from({ length: 12 }, (_, i) => `語${i},kata ${i}`)
        const csv = ["kosakata,arti", ...rows, "水,", `${"長".repeat(201)},panjang`].join("\n") + "\n"

        const error = yield* upload(token, deckSlug, csv, ["term", "meaning"]).pipe(Effect.flip)

        expect(error._tag).toBe("ImportRejected")
        if (error._tag !== "ImportRejected") return
        expect(error.errors).toEqual([
          { row: 14, column: "Meaning (arti)", message: "is required" },
          { row: 15, column: "Term (kosakata)", message: "is longer than 200 characters" }
        ])
        expect(yield* liveWordCount(deckSlug)).toBe(0)
      })
    ))

  test("a blank header is named by its position in a row error", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()

        const error = yield* upload(token, deckSlug, "kosakata,\n水,\n", ["term", "meaning"]).pipe(Effect.flip)

        expect(error._tag).toBe("ImportRejected")
        if (error._tag !== "ImportRejected") return
        expect(error.errors).toEqual([{ row: 2, column: "Meaning (column 2)", message: "is required" }])
      })
    ))

  test("a match whose length differs from the header is rejected on row 1", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()

        const error = yield* upload(token, deckSlug, "kosakata,arti,cara baca\n水,air,みず\n", ["term", "meaning"]).pipe(
          Effect.flip
        )

        expect(error._tag).toBe("ImportRejected")
        if (error._tag !== "ImportRejected") return
        expect(error.errors).toEqual([
          { row: 1, column: null, message: "The file has 3 columns, but 2 were matched" }
        ])
        expect(yield* liveWordCount(deckSlug)).toBe(0)
      })
    ))

  test.each([
    ["no column for Meaning", ["term", null]],
    ["Term on two columns", ["term", "term", "meaning"]]
  ])("a match with %s is refused before the file is read", (_, columns) =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()

        const refused = yield* upload(token, deckSlug, "a,b,c\n水,air,みず\n", columns).pipe(Effect.exit)

        expect(Exit.isFailure(refused)).toBe(true)
        expect(yield* liveWordCount(deckSlug)).toBe(0)
      })
    ))
})

describe("POST /decks/:deckSlug/import without columns", () => {
  test("the known names are matched and every other column is ignored", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        const csv = `Term, MEANING ,pinyin,colour\n学习,belajar,xuéxí,${"x".repeat(3000)}\n`

        expect(yield* upload(token, deckSlug, csv)).toEqual({ imported: 1, skippedDuplicates: 0 })
        expect(yield* words(token, deckSlug)).toEqual([word("学习", "belajar", "xuéxí")])
      })
    ))

  test("when two known names want one field, the first column gets it", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()

        yield* upload(token, deckSlug, "term,meaning,hiragana,reading\n水,air,みず,ちがう\n")

        expect(yield* words(token, deckSlug)).toEqual([word("水", "air", "みず")])
      })
    ))

  test("a file with no column for Meaning is rejected on row 1", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()

        const error = yield* upload(token, deckSlug, "term,arti\n水,air\n").pipe(Effect.flip)

        expect(error._tag).toBe("ImportRejected")
        if (error._tag !== "ImportRejected") return
        expect(error.errors).toEqual([{ row: 1, column: null, message: "No column is matched to Meaning" }])
      })
    ))
})

describe("POST /imports with matched columns", () => {
  test("50 files with the same names in two orders import into the right fields with one match each", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")
        const files = Array.from({ length: 50 }, (_, i): CsvFile =>
          i % 2 === 0
            ? [`Bab ${i}.csv`, `kosakata,arti,cara baca\n語${i},kata ${i},ご${i}\n`, ["term", "meaning", "reading"]]
            : [`Bab ${i}.csv`, `cara baca,kosakata,arti\nご${i},語${i},kata ${i}\n`, ["reading", "term", "meaning"]]
        )

        const started = yield* uploadBatch(token, files)
        const done = yield* finished(token, started.slug)

        expect(done.files.flatMap((file) => file.errors)).toEqual([])
        expect(done.files.every((file) => file.status === "done")).toBe(true)
        expect(yield* deckWords(token, done, 0)).toEqual([word("語0", "kata 0", "ご0")])
        expect(yield* deckWords(token, done, 1)).toEqual([word("語1", "kata 1", "ご1")])
      })
    ))

  test("files with completely different names import, each with its own match", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")
        const files = Array.from({ length: 50 }, (_, i): CsvFile =>
          i < 30
            ? [`Bab ${i}.csv`, `kosakata,arti\n語${i},kata ${i}\n`, ["term", "meaning"]]
            : [`Unit ${i}.csv`, `word,translation,notes\nw${i},t${i},n${i}\n`, ["term", "meaning", null]]
        )

        const started = yield* uploadBatch(token, files)
        const done = yield* finished(token, started.slug)

        expect(done.files.flatMap((file) => file.errors)).toEqual([])
        expect(done.files.every((file) => file.status === "done")).toBe(true)
        expect(yield* deckWords(token, done, 0)).toEqual([word("語0", "kata 0")])
        expect(yield* deckWords(token, done, 49)).toEqual([word("w49", "t49")])
      })
    ))

  test("a file's row errors keep the Learner's column names; the other files still import", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")

        const started = yield* uploadBatch(token, [
          ["Bab 1.csv", "kosakata,arti\n水,\n", ["term", "meaning"]],
          ["Bab 2.csv", "kosakata,arti\n火,api\n", ["term", "meaning"]]
        ])
        const done = yield* finished(token, started.slug)

        expect(done.files[0]!.errors).toEqual([{ row: 2, column: "Meaning (arti)", message: "is required" }])
        expect(done.files.map((file) => file.status)).toEqual(["failed", "done"])
        expect(yield* deckWords(token, done, 1)).toEqual([word("火", "api")])
      })
    ))

  test("a file whose header doesn't fit its match fails on row 1; the other files still import", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")

        const started = yield* uploadBatch(token, [
          ["Bab 1.csv", "kosakata,arti,cara baca\n水,air,みず\n", ["term", "meaning"]],
          ["Bab 2.csv", "kosakata,arti\n火,api\n", ["term", "meaning"]]
        ])
        const done = yield* finished(token, started.slug)

        expect(done.files[0]!.errors).toEqual([
          { row: 1, column: null, message: "The file has 3 columns, but 2 were matched" }
        ])
        expect(done.files.map((file) => file.status)).toEqual(["failed", "done"])
      })
    ))

  test("a match for each file is required when columns are sent; nothing is stored otherwise", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")
        const files: ReadonlyArray<CsvFile> = [
          ["Bab 1.csv", "kosakata,arti\n水,air\n", ["term", "meaning"]],
          ["Bab 2.csv", "kosakata,arti\n火,api\n", ["term", "meaning"]]
        ]

        const refused = yield* uploadBatch(token, files, [["term", "meaning"]]).pipe(Effect.exit)
        yield* Effect.promise(() => Bun.sleep(500))

        expect(Exit.isFailure(refused)).toBe(true)
        expect(yield* list(token)).toEqual([])
      })
    ))
})
