import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { TokenSigner } from "../src/identity/application/ports.ts"
import { at, call, makeIdentityRuntime, seedLearner } from "./identity.ts"
import { resetDb } from "./setup.ts"

// Several new words saved in one request, all or nothing: one word colliding with the deck or with another word of
// the batch saves none, and the error names every colliding word by its position in the request.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T00:00:00Z"))))

const signedIn = (slug: string) =>
  Effect.gen(function* () {
    yield* seedLearner(slug)
    const signer = yield* TokenSigner
    return (yield* signer.sign(slug as never)).token
  })

/** A deck owned by a fresh Learner, plus their token. */
const ownDeck = (slug = "ABCDEFGH") =>
  Effect.gen(function* () {
    const token = yield* signedIn(slug)
    const deck = yield* call(
      (c) => c.library.createDeck({ payload: { title: "N5", termLang: "ja", meaningLang: "en" } }),
      token
    )
    return { token, deckSlug: String(deck.slug) }
  })

type NewWord = { term: string; meaning: string; reading?: string; example?: string; notes?: string }

const addWords = (token: string, deckSlug: string, words: ReadonlyArray<NewWord>) =>
  call(
    (c) => c.library.createWords({ params: { deckSlug: deckSlug as never }, payload: { words: words as never } }),
    token
  )

const addWord = (token: string, deckSlug: string, word: NewWord) =>
  call((c) => c.library.createWord({ params: { deckSlug: deckSlug as never }, payload: word }), token)

const terms = (token: string, deckSlug: string) =>
  Effect.map(
    call((c) => c.library.listWords({ params: { deckSlug: deckSlug as never }, query: {} }), token),
    (page) => page.items.map((word) => word.term).sort()
  )

describe("POST /decks/:deckSlug/words/batch", () => {
  test("saves every word and answers them in request order", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()

        const saved = yield* addWords(token, deckSlug, [
          { term: "犬", meaning: "dog", reading: "いぬ" },
          { term: "猫", meaning: "cat", example: "猫が好き" },
          { term: "鳥", meaning: "bird", notes: "also chicken" }
        ])

        expect(saved.map((word) => word.term)).toEqual(["犬", "猫", "鳥"])
        expect(saved[0]).toMatchObject({ reading: "いぬ", example: null, notes: null })
        expect(saved[1]).toMatchObject({ reading: null, example: "猫が好き" })
        expect(new Set(saved.map((word) => String(word.slug))).size).toBe(3)
        expect(yield* terms(token, deckSlug)).toEqual(["犬", "猫", "鳥"].sort())
      })
    ))

  test("a word already in the deck saves none, and names that word", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        yield* addWord(token, deckSlug, { term: "Apple", meaning: "fruit" })

        const error = yield* addWords(token, deckSlug, [
          { term: "犬", meaning: "dog" },
          { term: " apple ", meaning: "again" },
          { term: "鳥", meaning: "bird" }
        ]).pipe(Effect.flip)

        expect(error._tag).toBe("DuplicateWords")
        expect(error._tag === "DuplicateWords" && error.indexes).toEqual([1])
        expect(yield* terms(token, deckSlug)).toEqual(["Apple"])
      })
    ))

  test("two words of the batch with the same term and reading are both named, and none is saved", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()

        const error = yield* addWords(token, deckSlug, [
          { term: "生", reading: "なま", meaning: "raw" },
          { term: "犬", meaning: "dog" },
          { term: "生", reading: "なま", meaning: "fresh" }
        ]).pipe(Effect.flip)

        expect(error._tag).toBe("DuplicateWords")
        expect(error._tag === "DuplicateWords" && [...error.indexes].sort()).toEqual([0, 2])
        expect(yield* terms(token, deckSlug)).toEqual([])
      })
    ))

  test("the same term with another reading is a different word", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()

        const saved = yield* addWords(token, deckSlug, [
          { term: "生", reading: "なま", meaning: "raw" },
          { term: "生", reading: "せい", meaning: "life" }
        ])

        expect(saved.map((word) => word.reading)).toEqual(["なま", "せい"])
      })
    ))

  test("50 words save; 51 are refused and none is saved", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token, deckSlug } = yield* ownDeck()
        const batch = (n: number, prefix: string) =>
          Array.from({ length: n }, (_, i) => ({ term: `${prefix}${i}`, meaning: `meaning ${i}` }))

        const refused = yield* addWords(token, deckSlug, batch(51, "x")).pipe(Effect.flip)
        const saved = yield* addWords(token, deckSlug, batch(50, "y"))

        expect(refused._tag).not.toBe("DuplicateWords")
        expect(saved.length).toBe(50)
        expect((yield* terms(token, deckSlug)).every((term) => term.startsWith("y"))).toBe(true)
      })
    ))

  test("another Learner's deck and an unknown deck answer 404", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* ownDeck("ABCDEFGH")
        const bob = yield* signedIn("JKMNPQRS")

        const theirs = yield* addWords(bob, ada.deckSlug, [{ term: "犬", meaning: "dog" }]).pipe(Effect.flip)
        const unknown = yield* addWords(ada.token, "ZZZZZZZZZZ", [{ term: "犬", meaning: "dog" }]).pipe(Effect.flip)

        expect(theirs._tag).toBe("NotFound")
        expect(unknown._tag).toBe("NotFound")
        expect(yield* terms(ada.token, ada.deckSlug)).toEqual([])
      })
    ))
})
