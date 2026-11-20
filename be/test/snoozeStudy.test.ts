import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { SqlClient } from "effect/sql"
import { at, call, makeIdentityRuntime } from "./identity.ts"
import { seedCard, seedDeck, signedIn, wordList } from "./seed.ts"
import { resetDb } from "./setup.ts"

// A snoozed deck is left out of Hard Words and its sessions while its snooze is live; its own deck page still studies
// it as usual. Snoozes are seeded with SQL: `snoozed_until` NULL means until unsnoozed.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T10:00:00Z"))))

const DUE = "2026-11-13T04:00:00Z"

const snoozeDeck = (deckId: bigint, until: string | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    yield* sql`UPDATE decks SET snoozed_at = '2026-11-14T09:00:00Z', snoozed_until = ${until === null ? null : new Date(until)}
      WHERE id = ${deckId}`
  })

const unsnoozeDeck = (deckId: bigint) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    yield* sql`UPDATE decks SET snoozed_at = NULL, snoozed_until = NULL WHERE id = ${deckId}`
  })

/** Two decks of 5 words, each word with a hard, due term_meaning card. */
const seedTwoHardDecks = (learnerId: bigint) =>
  Effect.gen(function* () {
    const sleepy = yield* seedDeck(learnerId, wordList(5, "眠"), { title: "Sleepy" })
    const awake = yield* seedDeck(learnerId, wordList(5, "起"), { title: "Awake" })

    for (const word of [...sleepy.words, ...awake.words]) {
      yield* seedCard(learnerId, word.id, "term_meaning", { due: DUE, hard: true })
    }

    return { sleepy, awake }
  })

const hardWordSlugs = (token: string) =>
  call((c) => c.study.hardWords({ query: {} }), token).pipe(
    Effect.map((page) => page.items.map((item) => String(item.slug)).sort())
  )

const hardSessionSlugs = (token: string) =>
  call(
    (c) =>
      c.study.start({ payload: { scope: { kind: "hard" }, drills: ["term_meaning"] as never, size: 20, mode: "easy" } }),
    token
  ).pipe(Effect.map((session) => session.questions.map((question) => String(question.wordSlug)).sort()))

const slugsOf = (deck: { readonly words: ReadonlyArray<{ readonly slug: string }> }) =>
  deck.words.map((word) => word.slug).sort()

describe("GET /hard-words", () => {
  test("leaves out a deck snoozed until unsnoozed", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const { sleepy, awake } = yield* seedTwoHardDecks(id)
        yield* snoozeDeck(sleepy.deckId, null)

        expect(yield* hardWordSlugs(token)).toEqual(slugsOf(awake))
      })
    ))

  test("leaves out a deck whose timed snooze has not ended", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const { sleepy, awake } = yield* seedTwoHardDecks(id)
        yield* snoozeDeck(sleepy.deckId, "2026-11-17T04:00:00Z")

        expect(yield* hardWordSlugs(token)).toEqual(slugsOf(awake))
      })
    ))

  test("unsnoozing brings the deck back on the next request", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const { sleepy, awake } = yield* seedTwoHardDecks(id)
        yield* snoozeDeck(sleepy.deckId, null)
        expect(yield* hardWordSlugs(token)).toEqual(slugsOf(awake))

        yield* unsnoozeDeck(sleepy.deckId)

        expect(yield* hardWordSlugs(token)).toEqual([...slugsOf(sleepy), ...slugsOf(awake)].sort())
      })
    ))

  test("the end of a timed snooze brings the deck back", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const { sleepy, awake } = yield* seedTwoHardDecks(id)
        yield* snoozeDeck(sleepy.deckId, "2026-11-15T04:00:00Z")
        expect(yield* hardWordSlugs(token)).toEqual(slugsOf(awake))

        yield* at("2026-11-15T04:00:00Z")

        expect(yield* hardWordSlugs(token)).toEqual([...slugsOf(sleepy), ...slugsOf(awake)].sort())
      })
    ))
})

describe("a hard-words session", () => {
  test("never picks a word of a snoozed deck", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const { sleepy, awake } = yield* seedTwoHardDecks(id)
        yield* snoozeDeck(sleepy.deckId, null)

        expect(yield* hardSessionSlugs(token)).toEqual(slugsOf(awake))
      })
    ))

  test("picks the deck again once its timed snooze has ended", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const { sleepy, awake } = yield* seedTwoHardDecks(id)
        yield* snoozeDeck(sleepy.deckId, "2026-11-14T04:00:00Z")

        expect(yield* hardSessionSlugs(token)).toEqual([...slugsOf(sleepy), ...slugsOf(awake)].sort())
      })
    ))
})

test("a session started from a snoozed deck's own page serves its words as usual", () =>
  rt.runPromise(
    Effect.gen(function* () {
      const { id, token } = yield* signedIn("AAAAAAA1")
      const { sleepy } = yield* seedTwoHardDecks(id)
      yield* snoozeDeck(sleepy.deckId, null)

      const session = yield* call(
        (c) =>
          c.study.start({
            payload: {
              scope: { kind: "deck", deckSlug: sleepy.deckSlug as never },
              drills: ["term_meaning"] as never,
              size: 7,
              mode: "easy"
            }
          }),
        token
      )

      expect(session.questions.map((question) => String(question.wordSlug)).sort()).toEqual(slugsOf(sleepy))
    })
  ))
