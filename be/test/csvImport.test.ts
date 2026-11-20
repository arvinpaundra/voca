import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { HttpClientRequest } from "effect/http"
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api"
import { SqlClient } from "effect/sql"
import { Authorization, IMPORT_MAX_BYTES, VocaApi } from "@voca/contract"
import { TokenSigner } from "../src/identity/application/ports.ts"
import { at, call, makeIdentityRuntime, seedLearner } from "./identity.ts"
import { resetDb } from "./setup.ts"

// CSV import and export of a deck: all or nothing, duplicates skipped and counted, export in the import format.
// Row numbers in errors are a spreadsheet's: the header is row 1, the first word row 2.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T00:00:00Z"))))

const signedIn = (slug: string) =>
  Effect.gen(function* () {
    yield* seedLearner(slug)
    const signer = yield* TokenSigner
    return (yield* signer.sign(slug as never)).token
  })

const newDeck = (token: string, title = "N5") =>
  Effect.map(
    call((c) => c.library.createDeck({ payload: { title, termLang: "ja", meaningLang: "en" } }), token),
    (deck) => String(deck.slug)
  )

/** A deck owned by a fresh Learner, plus their token. */
const ownDeck = (slug = "ABCDEFGH") =>
  Effect.gen(function* () {
    const token = yield* signedIn(slug)
    const deckSlug = yield* newDeck(token)
    return { token, deckSlug }
  })

const upload = (token: string, deckSlug: string, content: string | Uint8Array<ArrayBuffer>) => {
  const form = new FormData()
  form.append("file", new Blob([content], { type: "text/csv" }), "words.csv")

  // A browser's fetch sets the multipart content type from the FormData body; the in-memory test client doesn't,
  // and `call`'s own middleware can't be overridden per request, so the upload builds its client the same way.
  const headers = HttpApiMiddleware.layerClient(Authorization, ({ next, request }) =>
    next(
      request.pipe(
        HttpClientRequest.bearerToken(token),
        HttpClientRequest.setHeader("content-type", "multipart/form-data")
      )
    )
  )

  return HttpApiTest.groups(VocaApi, ["library"]).pipe(
    Effect.flatMap((c) => c.library.importCsv({ params: { deckSlug: deckSlug as never }, payload: form })),
    Effect.provide(headers),
    Effect.scoped
  )
}

const exportCsv = (token: string, deckSlug: string) =>
  call((c) => c.library.exportCsv({ params: { deckSlug: deckSlug as never } }), token)

const words = (token: string, deckSlug: string) =>
  Effect.map(
    call((c) => c.library.listWords({ params: { deckSlug: deckSlug as never }, query: { limit: 200 } }), token),
    (page) =>
      page.items
        .map((w) => ({ term: w.term, reading: w.reading, meaning: w.meaning, example: w.example, notes: w.notes }))
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

/** A header plus `n` distinct, valid rows. */
const rows = (n: number) =>
  ["term,meaning", ...Array.from({ length: n }, (_, i) => `語${i},word ${i}`)].join("\n") + "\n"

describe("POST /decks/:deckSlug/import", () => {
  test("imports every row, whatever the header's case, order and reading alias", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        const csv = "Meaning,TERM,hiragana,notes\nto eat,食べる,たべる,ichidan verb\n\"life, living\",生活,せいかつ,\n"

        const result = yield* upload(token, deckSlug, csv)

        expect(result).toEqual({ imported: 2, skippedDuplicates: 0 })
        expect(yield* words(token, deckSlug)).toEqual([
          { term: "生活", reading: "せいかつ", meaning: "life, living", example: null, notes: null },
          { term: "食べる", reading: "たべる", meaning: "to eat", example: null, notes: "ichidan verb" }
        ])
      })
    ))

  test("a leading BOM is ignored", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()

        expect(yield* upload(token, deckSlug, "﻿term,meaning\n水,water\n")).toEqual({ imported: 1, skippedDuplicates: 0 })
      })
    ))

  test("duplicates in the file and against the deck are skipped and counted, by the normalized key", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        yield* call(
          (c) => c.library.createWord({ params: { deckSlug: deckSlug as never }, payload: { term: "カタカナ", meaning: "katakana" } }),
          token
        )

        const result = yield* upload(token, deckSlug, "term,meaning\nｶﾀｶﾅ,katakana\n新しい,new\n新しい,new again\n")

        expect(result).toEqual({ imported: 1, skippedDuplicates: 2 })
        expect(yield* liveWordCount(deckSlug)).toBe(2)
      })
    ))

  test("a deleted word imported again is imported, not skipped", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        const word = yield* call(
          (c) => c.library.createWord({ params: { deckSlug: deckSlug as never }, payload: { term: "猫", meaning: "cat" } }),
          token
        )
        yield* call((c) => c.library.deleteWord({ params: { wordSlug: word.slug } }), token)

        expect(yield* upload(token, deckSlug, "term,meaning\n猫,cat\n")).toEqual({ imported: 1, skippedDuplicates: 0 })
      })
    ))

  test("one bad row in 1,000 writes nothing and names its row", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        const lines = rows(1000).split("\n")
        lines[500] = "語499,"

        const error = yield* upload(token, deckSlug, lines.join("\n")).pipe(Effect.flip)

        expect(error._tag).toBe("ImportRejected")
        if (error._tag !== "ImportRejected") return
        expect(error.totalErrors).toBe(1)
        expect(error.errors).toEqual([{ row: 501, column: "meaning", message: expect.any(String) }])
        expect(yield* liveWordCount(deckSlug)).toBe(0)
      })
    ))

  test("at most 100 errors come back, with the total", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        const csv = ["term,meaning", ...Array.from({ length: 150 }, (_, i) => `語${i},`)].join("\n")

        const error = yield* upload(token, deckSlug, csv).pipe(Effect.flip)

        expect(error._tag).toBe("ImportRejected")
        if (error._tag !== "ImportRejected") return
        expect(error.errors).toHaveLength(100)
        expect(error.totalErrors).toBe(150)
        expect(error.errors[0]!.row).toBe(2)
      })
    ))

  test.each([
    ["an unknown column", "term,meaning,colour\n赤,red,red\n", "colour"],
    ["a missing required column", "term,reading\n赤,あか\n", "meaning"]
  ])("%s rejects the header (row 1)", (_, csv, column) =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()

        const error = yield* upload(token, deckSlug, csv).pipe(Effect.flip)

        expect(error._tag).toBe("ImportRejected")
        if (error._tag !== "ImportRejected") return
        expect(error.errors).toContainEqual({ row: 1, column, message: expect.any(String) })
        expect(yield* liveWordCount(deckSlug)).toBe(0)
      })
    ))

  test("a file that isn't UTF-8 is rejected with a hint", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        // "term,meaning\ncafé,café" in Latin-1: 0xE9 alone is invalid UTF-8.
        const latin1 = new Uint8Array([...new TextEncoder().encode("term,meaning\ncaf"), 0xe9, 0x2c, 0x63, 0x61, 0x66, 0xe9, 0x0a])

        const error = yield* upload(token, deckSlug, latin1).pipe(Effect.flip)

        expect(error._tag).toBe("ImportRejected")
        expect(error.message).toContain("Save as CSV UTF-8")
      })
    ))

  test("more than 20,000 rows is rejected", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()

        const error = yield* upload(token, deckSlug, rows(20_001)).pipe(Effect.flip)

        expect(error._tag).toBe("ImportRejected")
        expect(yield* liveWordCount(deckSlug)).toBe(0)
      })
    ))

  test("20,000 rows import in under 3 seconds", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        const csv = rows(20_000)

        const started = performance.now()
        const result = yield* upload(token, deckSlug, csv)

        expect(performance.now() - started).toBeLessThan(3000)
        expect(result).toEqual({ imported: 20_000, skippedDuplicates: 0 })
      })
    ), 30_000)

  test("a file over 5 MB answers 413 before it is parsed", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()

        const error = yield* upload(token, deckSlug, new Uint8Array(IMPORT_MAX_BYTES + 1).fill(0x61)).pipe(Effect.flip)

        expect(error._tag).toBe("PayloadTooLarge")
      })
    ))

  test("another Learner's deck, or an unknown one, is 404", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { deckSlug } = yield* ownDeck("ABCDEFGH")
        const bob = yield* signedIn("JKMNPQRS")

        const theirs = yield* upload(bob, deckSlug, "term,meaning\n水,water\n").pipe(Effect.flip)
        const unknown = yield* upload(bob, "zzzzzzzzzz", "term,meaning\n水,water\n").pipe(Effect.flip)

        expect(theirs._tag).toBe("NotFound")
        expect(unknown._tag).toBe("NotFound")
        expect(yield* liveWordCount(deckSlug)).toBe(0)
      })
    ))
})

describe("GET /decks/:deckSlug/export", () => {
  test("exports in the import format, and the export imports back to the same words", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        const csv = [
          "term,meaning,reading,example,notes",
          '生活,"life, living",せいかつ,,',
          '言う,"to say ""so""",いう,"彼は\nそう言った",godan verb',
          "水,water,,,"
        ].join("\n")
        yield* upload(token, deckSlug, csv)

        const exported = yield* exportCsv(token, deckSlug)

        expect(exported.split(/\r?\n/)[0]).toBe("term,meaning,reading,example,notes")

        const copy = yield* newDeck(token, "Copy")
        expect(yield* upload(token, copy, exported)).toEqual({ imported: 3, skippedDuplicates: 0 })
        expect(yield* words(token, copy)).toEqual(yield* words(token, deckSlug))
      })
    ))

  test("another Learner's deck is 404", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { deckSlug } = yield* ownDeck("ABCDEFGH")
        const bob = yield* signedIn("JKMNPQRS")

        const error = yield* exportCsv(bob, deckSlug).pipe(Effect.flip)

        expect(error._tag).toBe("NotFound")
      })
    ))
})
