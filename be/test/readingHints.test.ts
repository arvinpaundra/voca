import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import type { Drill, Question } from "@voca/contract"
import { at, call, makeIdentityRuntime } from "./identity.ts"
import { seedDeck, signedIn, wordList, type NewWord } from "./seed.ts"
import { resetDb } from "./setup.ts"

// No reading hints: a question never carries the reading as ruby, and every answer hands the feedback the
// answered word's reading (null for a word without one).

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T10:00:00Z"))))

const start = (token: string, deckSlug: string, drills: ReadonlyArray<Drill>) =>
  call(
    (c) =>
      c.study.start({
        payload: { scope: { kind: "deck", deckSlug: deckSlug as never }, drills: drills as never, size: 7, mode: "easy" }
      }),
    token
  )

const answer = (token: string, sessionSlug: string, question: Question, right: boolean) => {
  const chosen = right
    ? question.wordSlug
    : question.options.find((option) => option.wordSlug !== question.wordSlug)!.wordSlug

  return call(
    (c) =>
      c.study.answer({
        params: { sessionSlug: sessionSlug as never },
        payload: { position: question.position, chosenWordSlug: chosen, latencyMs: 2000 }
      }),
    token
  )
}

const ALL_DRILLS: ReadonlyArray<Drill> = ["term_meaning", "meaning_term", "term_reading", "reading_term"]

describe("questions carry no ruby", () => {
  test.each(ALL_DRILLS.map((drill) => [drill]))("%s", (drill) =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const deck = yield* seedDeck(id, wordList(8))

        const session = yield* start(token, deck.deckSlug, [drill])

        expect(session.questions.length).toBeGreaterThan(0)
        expect(session.questions.map((question) => question.prompt.ruby)).toEqual(session.questions.map(() => null))
      })
    ))

  test("a retry carries no ruby either", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const deck = yield* seedDeck(id, wordList(8))
        const session = yield* start(token, deck.deckSlug, ["term_meaning"])

        const result = yield* answer(token, session.slug, session.questions[0]!, false)

        expect(result.retry?.prompt.ruby).toBeNull()
      })
    ))
})

describe("the answer carries the word's reading", () => {
  test("right and wrong answers, in every drill of a mixed session", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const deck = yield* seedDeck(id, wordList(10))
        const readingOf = new Map(deck.words.map((word) => [String(word.slug), word.reading]))

        const session = yield* start(token, deck.deckSlug, ALL_DRILLS)

        for (const [i, question] of session.questions.entries()) {
          const result = yield* answer(token, session.slug, question, i % 2 === 0)

          expect([question.drill, result.reading]).toEqual([question.drill, readingOf.get(String(question.wordSlug))])
        }
      })
    ))

  test("a retry's answer carries it too", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const deck = yield* seedDeck(id, wordList(8))
        const session = yield* start(token, deck.deckSlug, ["meaning_term"])
        const first = session.questions[0]!
        const reading = deck.words.find((word) => word.slug === first.wordSlug)!.reading

        const wrong = yield* answer(token, session.slug, first, false)
        const retried = yield* answer(token, session.slug, wrong.retry!, true)

        expect(retried.reading).toBe(reading)
      })
    ))

  test("null for a word without a reading", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const plain: ReadonlyArray<NewWord> = ["hola", "adiós", "gato", "perro", "casa"].map((term, i) => ({
          term,
          meaning: `meaning ${i}`
        }))
        const deck = yield* seedDeck(id, plain, { termLang: "es" })

        const session = yield* start(token, deck.deckSlug, ["term_meaning"])
        const result = yield* answer(token, session.slug, session.questions[0]!, true)

        expect(result.reading).toBeNull()
      })
    ))
})
