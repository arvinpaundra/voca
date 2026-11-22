import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect, Exit, Fiber, Stream } from "effect"
import { HttpClientRequest } from "effect/http"
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api"
import { SqlClient } from "effect/sql"
import { TestClock } from "effect/testing"
import { Authorization, VocaApi } from "@voca/contract"
import type { ImportBatch, ImportBatchSlug } from "@voca/contract"
import { TokenSigner } from "../src/identity/application/ports.ts"
import { at, call, makeIdentityRuntime, seedLearner, testBeanstalk } from "./identity.ts"
import { resetDb } from "./setup.ts"

// Importing several CSV files, each into a new deck, in the background: the worker takes one beanstalkd job per file.
// The batches are read back through GET /imports until every file is finished.

const rt = makeIdentityRuntime(undefined, { imports: testBeanstalk("importBatches") })
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-22T00:00:00Z"))))

/** A token for the Learner, seeded unless `seed` is false (a second sign-in of the same Learner). */
const signedIn = (slug: string, seed = true) =>
  Effect.gen(function* () {
    if (seed) yield* seedLearner(slug)
    const signer = yield* TokenSigner
    return (yield* signer.sign(slug as never)).token
  })

type CsvFile = readonly [name: string, content: string]

const upload = (token: string, files: ReadonlyArray<CsvFile>, langs = { termLang: "ja", meaningLang: "en" }) => {
  const form = new FormData()
  form.append("termLang", langs.termLang)
  form.append("meaningLang", langs.meaningLang)
  for (const [name, content] of files) form.append("files", new Blob([content], { type: "text/csv" }), name)

  // The in-memory test client doesn't set the multipart content type from the FormData body, as a browser does.
  const headers = HttpApiMiddleware.layerClient(Authorization, ({ next, request }) =>
    next(
      request.pipe(
        HttpClientRequest.bearerToken(token),
        HttpClientRequest.setHeader("content-type", "multipart/form-data")
      )
    )
  )

  return HttpApiTest.groups(VocaApi, ["imports"]).pipe(
    Effect.flatMap((c) => c.imports.importDecks({ payload: form })),
    Effect.provide(headers),
    Effect.scoped
  )
}

const list = (token: string) => call((c) => c.imports.listImports(), token)

const isFinished = (batch: ImportBatch) => batch.files.every((file) => file.status === "done" || file.status === "failed")

/** The batch once every file is finished. Real time: the worker runs outside the test clock. */
const finished = (token: string, slug: ImportBatchSlug) =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < 150; attempt++) {
      const batch = (yield* list(token)).find((b) => b.slug === slug)
      if (batch !== undefined && isFinished(batch)) return batch
      yield* Effect.promise(() => Bun.sleep(100))
    }
    return yield* Effect.die(`batch ${slug} did not finish in 15 s`)
  })

const decks = (token: string) =>
  Effect.map(call((c) => c.library.listDecks(), token), (all) =>
    all.map((d) => ({ title: d.title, termLang: d.termLang, meaningLang: d.meaningLang, words: d.wordCount }))
  )

const csv = (rows: number, prefix = "語") =>
  ["term,meaning", ...Array.from({ length: rows }, (_, i) => `${prefix}${i},word ${i}`)].join("\n") + "\n"

describe("POST /imports", () => {
  test("five valid files create five decks, each named after its file, in the chosen languages", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")
        const files: ReadonlyArray<CsvFile> = [
          ["N5 verbs.csv", csv(3, "動")],
          ["N5 nouns.csv", csv(2, "名")],
          ["Particles.csv", csv(1, "助")],
          ["Counters.csv", csv(4, "数")],
          ["Adverbs.txt.csv", csv(5, "副")]
        ]

        const started = yield* upload(token, files, { termLang: "ja", meaningLang: "id" })

        expect(started.files.map((f) => f.name)).toEqual(files.map(([name]) => name))
        expect(started.termLang).toBe("ja")

        const done = yield* finished(token, started.slug)

        expect(done.files.map((f) => [f.status, f.deck?.title, f.imported])).toEqual([
          ["done", "N5 verbs", 3],
          ["done", "N5 nouns", 2],
          ["done", "Particles", 1],
          ["done", "Counters", 4],
          ["done", "Adverbs.txt", 5]
        ])
        expect((yield* decks(token)).sort((a, b) => a.title.localeCompare(b.title))).toEqual([
          { title: "Adverbs.txt", termLang: "ja", meaningLang: "id", words: 5 },
          { title: "Counters", termLang: "ja", meaningLang: "id", words: 4 },
          { title: "N5 nouns", termLang: "ja", meaningLang: "id", words: 2 },
          { title: "N5 verbs", termLang: "ja", meaningLang: "id", words: 3 },
          { title: "Particles", termLang: "ja", meaningLang: "id", words: 1 }
        ])
      })
    ))

  test("a file with invalid rows creates no deck and lists the first 100 errors; the other files still do", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")
        const invalid = ["term,meaning", ...Array.from({ length: 101 }, (_, i) => `語${i},`)].join("\n") + "\n"

        const started = yield* upload(token, [["good one.csv", csv(2)], ["broken.csv", invalid], ["good two.csv", csv(1, "名")]])
        const done = yield* finished(token, started.slug)
        const broken = done.files[1]!

        expect(done.files.map((f) => f.status)).toEqual(["done", "failed", "done"])
        expect(broken.deck).toBeNull()
        expect(broken.errors).toHaveLength(100)
        expect(broken.totalErrors).toBe(101)
        expect(broken.errors[0]!.row).toBe(2) // the header is row 1
        expect((yield* decks(token)).map((d) => d.title).sort()).toEqual(["good one", "good two"])
      })
    ))

  test("a header-only file creates a deck with 0 words", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")

        const started = yield* upload(token, [["Empty.csv", "term,meaning,reading,example,notes\n"]])
        const done = yield* finished(token, started.slug)

        expect(done.files[0]).toMatchObject({ status: "done", imported: 0, skippedDuplicates: 0 })
        expect(yield* decks(token)).toEqual([{ title: "Empty", termLang: "ja", meaningLang: "en", words: 0 }])
      })
    ))

  test("duplicates within a file are skipped and counted", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")

        const started = yield* upload(token, [["Dupes.csv", "term,meaning\n水,water\n水,water again\n火,fire\n"]])
        const done = yield* finished(token, started.slug)

        expect(done.files[0]).toMatchObject({ status: "done", imported: 2, skippedDuplicates: 1 })
      })
    ))

  test("a file named like an existing deck creates a second deck with that name", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")
        yield* call((c) => c.library.createDeck({ payload: { title: "N5 verbs", termLang: "ja", meaningLang: "en" } }), token)

        const started = yield* upload(token, [["N5 verbs.csv", csv(1)]])
        yield* finished(token, started.slug)

        expect((yield* decks(token)).filter((d) => d.title === "N5 verbs")).toHaveLength(2)
      })
    ))

  test("a file name is trimmed and cut to 120 characters; a name with nothing left fails the file", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")
        const long = "あ".repeat(130)

        const started = yield* upload(token, [[`  ${long}.csv`, csv(1)], [".csv", csv(1, "名")]])
        const done = yield* finished(token, started.slug)

        expect(done.files[0]!.deck?.title).toBe("あ".repeat(120))
        expect(done.files[1]).toMatchObject({ status: "failed", deck: null })
        expect(done.files[1]!.errors.length).toBeGreaterThan(0)
      })
    ))

  test("fifty files are accepted and each becomes a deck", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")
        const files = Array.from({ length: 50 }, (_, i): CsvFile => [`deck ${i}.csv`, csv(1, `w${i}-`)])

        const started = yield* upload(token, files)
        const done = yield* finished(token, started.slug)

        expect(done.files).toHaveLength(50)
        expect(done.files.every((f) => f.status === "done")).toBe(true)
        expect(yield* decks(token)).toHaveLength(50)
      })
    ))

  test("files totalling more than 50 MB are refused before anything is imported", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")
        // Each file is 4.8 MiB, under the 5 MB limit; eleven of them are 52.8 MiB together.
        const big = "term,meaning\n" + "x".repeat(Math.floor(4.8 * 1024 * 1024))
        const files = Array.from({ length: 11 }, (_, i): CsvFile => [`deck ${i}.csv`, big])

        const refused = yield* upload(token, files).pipe(Effect.flip)

        expect(refused._tag).toBe("PayloadTooLarge")
        expect(yield* list(token)).toEqual([])
        expect(yield* decks(token)).toEqual([])
      })
    ))

  test("more than 50 files are refused before anything is imported", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")
        const files = Array.from({ length: 51 }, (_, i): CsvFile => [`deck ${i}.csv`, csv(1)])

        // The 400 comes back as a defect from the test client, so read the exit rather than flip the error.
        const refused = yield* upload(token, files).pipe(Effect.exit)
        yield* Effect.promise(() => Bun.sleep(500))

        expect(Exit.isFailure(refused)).toBe(true)

        expect(yield* list(token)).toEqual([])
        expect(yield* decks(token)).toEqual([])
      })
    ))

  test("two batches started back to back both complete, each with its own files, newest first", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")

        const first = yield* upload(token, [["A.csv", csv(2)], ["B.csv", csv(1)]])
        yield* TestClock.adjust("1 second")
        const second = yield* upload(token, [["C.csv", csv(3, "名")]])
        yield* finished(token, first.slug)
        yield* finished(token, second.slug)

        const batches = yield* list(token)

        expect(batches.map((b) => b.slug)).toEqual([second.slug, first.slug])
        expect(batches.map((b) => b.files.map((f) => f.deck?.title))).toEqual([["C"], ["A", "B"]])
      })
    ))
})

describe("GET and DELETE /imports", () => {
  test("a batch survives a new sign-in, is the Learner's alone, and is gone once dismissed", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")
        const started = yield* upload(token, [["A.csv", csv(1)]])
        yield* finished(token, started.slug)

        const again = yield* signedIn("ABCDEFGH", false)
        const other = yield* signedIn("ZYXWVTSR")

        expect((yield* list(again)).map((b) => b.slug)).toEqual([started.slug])
        expect(yield* list(other)).toEqual([])

        const foreign = yield* call((c) => c.imports.dismissImport({ params: { batchSlug: started.slug } }), other).pipe(Effect.flip)
        expect(foreign._tag).toBe("NotFound")

        yield* call((c) => c.imports.dismissImport({ params: { batchSlug: started.slug } }), again)

        expect(yield* list(token)).toEqual([])
      })
    ))

  test("a batch with a file still pending can't be dismissed", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const learnerId = yield* seedLearner("ABCDEFGH")
        const token = yield* signedIn("ABCDEFGH", false)
        const sql = yield* SqlClient.SqlClient

        // No job is put for this file, so the worker never takes it: it stays pending.
        const [batch] = yield* sql<{ readonly id: string }>`
          INSERT INTO import_batches (slug, learner_id, term_lang, meaning_lang, created_at, dismissed_at)
          VALUES ('PENDNGBATCH00001', ${learnerId}, 'ja', 'en', '2026-11-22T00:00:00Z', NULL)
          RETURNING id::text AS id`
        yield* sql`
          INSERT INTO import_files (batch_id, position, name, content, status, deck_id, imported, skipped_duplicates,
            errors, total_errors)
          VALUES (${batch!.id}, 0, 'A.csv', ${new TextEncoder().encode(csv(1))}, 'pending', NULL, 0, 0, '[]'::jsonb, 0)`

        const error = yield* call(
          (c) => c.imports.dismissImport({ params: { batchSlug: "PENDNGBATCH00001" as ImportBatchSlug } }),
          token
        ).pipe(Effect.flip)

        expect(error._tag).toBe("ImportRunning")
        expect((yield* list(token)).map((b) => b.files[0]!.status)).toEqual(["pending"])
      })
    ))
})

describe("import events", () => {
  const ticket = (token: string) => Effect.map(call((c) => c.imports.importEventsTicket(), token), (t) => t.ticket)

  const events = (value: string) => call((c) => c.importEvents.importEvents({ query: { ticket: value } }))

  test("the stream says a batch is running, then finished", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")
        const value = yield* ticket(token)

        const seen = yield* events(value).pipe(
          Effect.flatMap((stream) =>
            stream.pipe(
              Stream.takeUntil((event) => event.status === "finished"),
              Stream.runCollect
            )
          ),
          Effect.forkChild
        )
        yield* Effect.promise(() => Bun.sleep(200))
        const started = yield* upload(token, [["A.csv", csv(1)], ["B.csv", csv(1, "名")]])
        const collected = Array.from(yield* Fiber.join(seen))

        expect(collected.every((event) => event.batch === started.slug)).toBe(true)
        expect(collected.some((event) => event.status === "running")).toBe(true)
        expect(collected.at(-1)?.status).toBe("finished")
      })
    ))

  test("a ticket opens the stream once", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")
        const value = yield* ticket(token)

        yield* events(value).pipe(Effect.flatMap((stream) => Stream.runCollect(Stream.take(stream, 0))))
        const error = yield* events(value).pipe(Effect.flip)

        expect(error._tag).toBe("Unauthorized")
      })
    ))

  test("an unknown ticket, or one older than 30 seconds, is refused", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const token = yield* signedIn("ABCDEFGH")
        const value = yield* ticket(token)

        expect((yield* events("not-a-ticket").pipe(Effect.flip))._tag).toBe("Unauthorized")

        yield* TestClock.adjust("31 seconds")

        expect((yield* events(value).pipe(Effect.flip))._tag).toBe("Unauthorized")
      })
    ))
})
