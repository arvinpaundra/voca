import { afterAll, beforeEach, expect, test } from "bun:test"
import { Effect } from "effect"
import { SqlClient } from "effect/sql"
import { TokenSigner } from "../src/identity/application/ports.ts"
import { at, call, makeIdentityRuntime } from "./identity.ts"
import { seedCard, seedDeck, signedIn, wordList } from "./seed.ts"
import { resetDb } from "./setup.ts"

// The notification panel (and the dashboard's Today card, which reads it) counts nothing from a deck whose snooze is
// live: no due or overdue card, no hard card, and none of its unstudied pairs towards the new count.
// Snoozes are seeded with SQL: `snoozed_until` NULL means until unsnoozed.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T10:00:00Z"))))

/** Moves the clock and signs a fresh access token: the old one would have expired. */
const later = (iso: string, slug = "AAAAAAA1") =>
  Effect.gen(function* () {
    yield* at(iso)
    const signer = yield* TokenSigner

    return (yield* signer.sign(slug as never)).token
  })

const OVERDUE = "2026-11-12T04:00:00Z"
const TODAY = "2026-11-14T08:00:00Z"

const snoozeDeck = (deckId: bigint, until: string | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    yield* sql`UPDATE decks SET snoozed_at = '2026-11-14T09:00:00Z', snoozed_until = ${until === null ? null : new Date(until)}
      WHERE id = ${deckId}`
  })

/**
 * Sleepy: 3 words with a due term_meaning card each (one overdue, one hard), so 9 unstudied pairs.
 * Awake: 1 word with a due term_meaning card, so 3 unstudied pairs.
 */
const seedDecks = (learnerId: bigint) =>
  Effect.gen(function* () {
    const sleepy = yield* seedDeck(learnerId, wordList(3, "眠"), { title: "Sleepy" })
    const awake = yield* seedDeck(learnerId, wordList(1, "起"), { title: "Awake" })

    yield* seedCard(learnerId, sleepy.words[0]!.id, "term_meaning", { due: OVERDUE })
    yield* seedCard(learnerId, sleepy.words[1]!.id, "term_meaning", { due: TODAY, hard: true })
    yield* seedCard(learnerId, sleepy.words[2]!.id, "term_meaning", { due: TODAY })
    yield* seedCard(learnerId, awake.words[0]!.id, "term_meaning", { due: TODAY })

    return { sleepy, awake }
  })

const panel = (token: string) =>
  call((c) => c.insight.notifications(), token).pipe(
    Effect.map((value) => ({
      decks: value.decks.map((deck) => [deck.deckSlug, deck.due, deck.overdue]),
      hardDue: value.hardDue,
      newAvailable: value.newAvailable
    }))
  )

const withoutSleepy = (awake: string) => ({ decks: [[awake, 1, 0]], hardDue: 0, newAvailable: 3 })

const withSleepy = (sleepy: string, awake: string) => ({
  decks: [
    [sleepy, 3, 1],
    [awake, 1, 0]
  ],
  hardDue: 1,
  newAvailable: 12
})

test("a deck snoozed until unsnoozed adds nothing to any count", () =>
  rt.runPromise(
    Effect.gen(function* () {
      const { id, token } = yield* signedIn("AAAAAAA1")
      const { sleepy, awake } = yield* seedDecks(id)
      yield* snoozeDeck(sleepy.deckId, null)

      expect(yield* panel(token)).toEqual(withoutSleepy(awake.deckSlug))
    })
  ))

test("unsnoozing brings the deck back on the next request", () =>
  rt.runPromise(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const { id, token } = yield* signedIn("AAAAAAA1")
      const { sleepy, awake } = yield* seedDecks(id)
      yield* snoozeDeck(sleepy.deckId, null)
      expect(yield* panel(token)).toEqual(withoutSleepy(awake.deckSlug))

      yield* sql`UPDATE decks SET snoozed_at = NULL, snoozed_until = NULL WHERE id = ${sleepy.deckId}`

      expect(yield* panel(token)).toEqual(withSleepy(sleepy.deckSlug, awake.deckSlug))
    })
  ))

test("a timed snooze counts until its end, and not after", () =>
  rt.runPromise(
    Effect.gen(function* () {
      const { id } = yield* signedIn("AAAAAAA1")
      const { sleepy, awake } = yield* seedDecks(id)
      yield* snoozeDeck(sleepy.deckId, "2026-11-15T04:00:00Z")

      const before = yield* later("2026-11-15T03:59:00Z")
      expect(yield* panel(before)).toEqual(withoutSleepy(awake.deckSlug))

      const after = yield* panel(yield* later("2026-11-15T04:00:00Z"))
      expect(after.decks.map(([slug]) => slug)).toEqual([sleepy.deckSlug, awake.deckSlug])
      expect(after.hardDue).toBe(1)
      expect(after.newAvailable).toBe(12)
    })
  ))

test("an ended snooze still in the row counts as awake", () =>
  rt.runPromise(
    Effect.gen(function* () {
      const { id, token } = yield* signedIn("AAAAAAA1")
      const { sleepy, awake } = yield* seedDecks(id)
      yield* snoozeDeck(sleepy.deckId, "2026-11-14T04:00:00Z")

      expect(yield* panel(token)).toEqual(withSleepy(sleepy.deckSlug, awake.deckSlug))
    })
  ))

test("every deck snoozed: an empty panel", () =>
  rt.runPromise(
    Effect.gen(function* () {
      const { id, token } = yield* signedIn("AAAAAAA1")
      const { sleepy, awake } = yield* seedDecks(id)
      yield* snoozeDeck(sleepy.deckId, null)
      yield* snoozeDeck(awake.deckId, "2026-11-21T04:00:00Z")

      expect(yield* panel(token)).toEqual({ decks: [], hardDue: 0, newAvailable: 0 })
    })
  ))
