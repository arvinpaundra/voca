import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { HttpClientRequest } from "effect/http"
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api"
import { Authorization, VocaApi } from "@voca/contract"
import { readWords } from "../src/library/domain/csvWords.ts"
import { TokenSigner } from "../src/identity/application/ports.ts"
import { at, call, makeIdentityRuntime, seedLearner } from "./identity.ts"
import { resetDb } from "./setup.ts"

// The import's header, blank-line and syntax rules that the locked import tests don't reach.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T00:00:00Z"))))

const signedIn = (slug: string) =>
  Effect.gen(function* () {
    yield* seedLearner(slug)
    const signer = yield* TokenSigner
    return (yield* signer.sign(slug as never)).token
  })

const ownDeck = (slug = "ABCDEFGH") =>
  Effect.gen(function* () {
    const token = yield* signedIn(slug)
    const deck = yield* call((c) => c.library.createDeck({ payload: { title: "N5", termLang: "ja", meaningLang: "en" } }), token)
    return { token, deckSlug: String(deck.slug) }
  })

const upload = (token: string, deckSlug: string, content: string) => {
  const form = new FormData()
  form.append("file", new Blob([content], { type: "text/csv" }), "words.csv")

  // The in-memory test client doesn't set the multipart content type, so the upload builds its client the same way
  // as the locked import tests.
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

describe("POST /decks/:deckSlug/import: the header", () => {
  test("a column named twice is rejected on the header row", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()

        const error = yield* upload(token, deckSlug, "term,meaning,hiragana,reading\n水,water,みず,みず\n").pipe(Effect.flip)

        expect(error._tag).toBe("ImportRejected")
        if (error._tag !== "ImportRejected") return
        expect(error.errors).toContainEqual({ row: 1, column: "reading", message: expect.any(String) })
      })
    ))

  test("a column name is matched without its surrounding spaces", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()

        expect(yield* upload(token, deckSlug, " term , meaning \n水,water\n")).toEqual({ imported: 1, skippedDuplicates: 0 })
      })
    ))
})

describe("POST /decks/:deckSlug/import: the rows", () => {
  test("a blank line is skipped and still counts in the row numbers", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()

        const error = yield* upload(token, deckSlug, "term,meaning\n水,water\n\n火,\n").pipe(Effect.flip)

        expect(error._tag).toBe("ImportRejected")
        if (error._tag !== "ImportRejected") return
        expect(error.errors).toEqual([{ row: 4, column: "meaning", message: expect.any(String) }])
      })
    ))

  test("a row with the wrong number of fields is rejected without a column", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()

        const error = yield* upload(token, deckSlug, "term,meaning\n水\n").pipe(Effect.flip)

        expect(error._tag).toBe("ImportRejected")
        if (error._tag !== "ImportRejected") return
        expect(error.errors).toEqual([{ row: 2, column: null, message: "Expected 2 fields, found 1" }])
      })
    ))

  test("a CSV syntax error is rejected as a whole, naming the record it is in", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()

        const error = yield* upload(token, deckSlug, 'term,meaning\n水,water\n"火,fire\n').pipe(Effect.flip)

        expect(error._tag).toBe("ImportRejected")
        if (error._tag !== "ImportRejected") return
        expect(error.message).toContain("isn't valid CSV")
        expect(error.errors).toEqual([{ row: 3, column: null, message: expect.any(String) }])
      })
    ))

})

describe("readWords", () => {
  test("a file with no records is an empty-file error on the header row", () => {
    expect(readWords([])).toEqual({
      rows: [],
      errors: [{ row: 1, column: null, message: "The file is empty" }]
    })
  })
})
