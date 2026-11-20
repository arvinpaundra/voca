import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { DateTime, Effect } from "effect"
import { SqlClient } from "effect/sql"
import type { Deck, SnoozeDays } from "@voca/contract"
import { TokenSigner } from "../src/identity/application/ports.ts"
import { at, call, makeIdentityRuntime } from "./identity.ts"
import { seedCard, seedDeck, signedIn, wordList } from "./seed.ts"
import { resetDb } from "./setup.ts"

// Deck snooze: the batch endpoints, the end of a timed snooze at the Learner's day start, and the snooze shown on
// every deck response. The Learner is in UTC with dayStartHour 4, and the clock sits on study date 2026-11-14.

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

const snooze = (token: string, deckSlugs: ReadonlyArray<string>, days: SnoozeDays | null) =>
  call((c) => c.library.snoozeDecks({ payload: { deckSlugs: deckSlugs as never, days } }), token)

const unsnooze = (token: string, deckSlugs: ReadonlyArray<string>) =>
  call((c) => c.library.unsnoozeDecks({ payload: { deckSlugs: deckSlugs as never } }), token)

const listDecks = (token: string) => call((c) => c.library.listDecks(), token)

const getDeck = (token: string, deckSlug: string) =>
  call((c) => c.library.getDeck({ params: { deckSlug: deckSlug as never } }), token)

/** The snooze as plain data: `null`, or the end as an ISO string (`null` = until unsnoozed). */
const snoozeOf = (deck: Pick<Deck, "snooze">) =>
  deck.snooze === undefined || deck.snooze === null
    ? null
    : { until: deck.snooze.until === null ? null : DateTime.formatIso(deck.snooze.until) }

const listedSnooze = (token: string, deckSlug: string) =>
  Effect.gen(function* () {
    const decks = yield* listDecks(token)
    const found = decks.find((deck) => deck.slug === deckSlug)!

    return snoozeOf(found)
  })

describe("POST /decks/snooze", () => {
  test.each([
    [1, "2026-11-15T04:00:00.000Z"],
    [3, "2026-11-17T04:00:00.000Z"],
    [7, "2026-11-21T04:00:00.000Z"],
    [14, "2026-11-28T04:00:00.000Z"]
  ] as const)("%p days ends at the day start of the end date (%s)", (days, until) =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const deck = yield* seedDeck(id, wordList(4))

        const snoozed = yield* snooze(token, [deck.deckSlug], days)

        expect(snoozed.map((each) => [each.slug, snoozeOf(each)])).toEqual([[deck.deckSlug, { until }]])
        expect(yield* listedSnooze(token, deck.deckSlug)).toEqual({ until })
        expect(snoozeOf(yield* getDeck(token, deck.deckSlug))).toEqual({ until })
      })
    ))

  test("the end follows the Learner's timezone", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient
        const { id, token } = yield* signedIn("AAAAAAA1")
        const deck = yield* seedDeck(id, wordList(4))
        yield* sql`UPDATE learners SET timezone = 'Asia/Jakarta' WHERE id = ${id}`

        const [snoozed] = yield* snooze(token, [deck.deckSlug], 3)

        // 17:00 in Jakarta on 14 Nov; three days later at 04:00 Jakarta time.
        expect(snoozeOf(snoozed!)).toEqual({ until: "2026-11-16T21:00:00.000Z" })
      })
    ))

  test("before the day start, today is still the previous study date", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id } = yield* signedIn("AAAAAAA1")
        const deck = yield* seedDeck(id, wordList(4))
        const early = yield* later("2026-11-14T02:00:00Z")

        const [snoozed] = yield* snooze(early, [deck.deckSlug], 1)

        expect(snoozeOf(snoozed!)).toEqual({ until: "2026-11-14T04:00:00.000Z" })
      })
    ))

  test("no end date lasts until the Learner unsnoozes", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const deck = yield* seedDeck(id, wordList(4))

        const [snoozed] = yield* snooze(token, [deck.deckSlug], null)
        expect(snoozeOf(snoozed!)).toEqual({ until: null })

        const fresh = yield* later("2027-03-01T10:00:00Z")
        expect(yield* listedSnooze(fresh, deck.deckSlug)).toEqual({ until: null })
      })
    ))

  test("a timed snooze is over once its end has passed", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const deck = yield* seedDeck(id, wordList(4))
        yield* snooze(token, [deck.deckSlug], 1)

        const before = yield* later("2026-11-15T03:59:00Z")
        expect(yield* listedSnooze(before, deck.deckSlug)).toEqual({ until: "2026-11-15T04:00:00.000Z" })

        const after = yield* later("2026-11-15T04:00:00Z")
        expect(yield* listedSnooze(after, deck.deckSlug)).toBeNull()
        expect(snoozeOf(yield* getDeck(after, deck.deckSlug))).toBeNull()
      })
    ))

  test("snoozing a snoozed deck replaces its end", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const deck = yield* seedDeck(id, wordList(4))
        yield* snooze(token, [deck.deckSlug], 14)

        yield* snooze(token, [deck.deckSlug], 1)

        expect(yield* listedSnooze(token, deck.deckSlug)).toEqual({ until: "2026-11-15T04:00:00.000Z" })
      })
    ))

  test("several decks in one request; the others stay awake", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const first = yield* seedDeck(id, wordList(4, "甲"))
        const second = yield* seedDeck(id, wordList(4, "乙"))
        const third = yield* seedDeck(id, wordList(4, "丙"))

        const snoozed = yield* snooze(token, [first.deckSlug, second.deckSlug], 7)

        expect(snoozed.map((deck) => deck.slug).sort()).toEqual([first.deckSlug, second.deckSlug].sort())
        expect(yield* listedSnooze(token, first.deckSlug)).toEqual({ until: "2026-11-21T04:00:00.000Z" })
        expect(yield* listedSnooze(token, second.deckSlug)).toEqual({ until: "2026-11-21T04:00:00.000Z" })
        expect(yield* listedSnooze(token, third.deckSlug)).toBeNull()
      })
    ))

  test("a deck of another Learner fails the whole batch, and nothing is snoozed", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const other = yield* signedIn("AAAAAAA2")
        const own = yield* seedDeck(id, wordList(4, "甲"))
        const theirs = yield* seedDeck(other.id, wordList(4, "乙"))

        const error = yield* snooze(token, [own.deckSlug, theirs.deckSlug], 3).pipe(Effect.flip)

        expect(error._tag).toBe("NotFound")
        expect(yield* listedSnooze(token, own.deckSlug)).toBeNull()
        expect(yield* listedSnooze(other.token, theirs.deckSlug)).toBeNull()
      })
    ))

  test("a deleted deck is not found", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient
        const { id, token } = yield* signedIn("AAAAAAA1")
        const deck = yield* seedDeck(id, wordList(4))
        yield* sql`UPDATE decks SET deleted_at = '2026-11-02T00:00:00Z' WHERE id = ${deck.deckId}`

        const error = yield* snooze(token, [deck.deckSlug], 3).pipe(Effect.flip)

        expect(error._tag).toBe("NotFound")
      })
    ))
})

describe("POST /decks/unsnooze", () => {
  test("ends a timed or open snooze at once", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const timed = yield* seedDeck(id, wordList(4, "甲"))
        const open = yield* seedDeck(id, wordList(4, "乙"))
        yield* snooze(token, [timed.deckSlug], 7)
        yield* snooze(token, [open.deckSlug], null)

        const awake = yield* unsnooze(token, [timed.deckSlug, open.deckSlug])

        expect(awake.map(snoozeOf)).toEqual([null, null])
        expect(yield* listedSnooze(token, timed.deckSlug)).toBeNull()
        expect(yield* listedSnooze(token, open.deckSlug)).toBeNull()
        expect(snoozeOf(yield* getDeck(token, open.deckSlug))).toBeNull()
      })
    ))

  test("a deck that isn't snoozed stays awake", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const deck = yield* seedDeck(id, wordList(4))

        const [awake] = yield* unsnooze(token, [deck.deckSlug])

        expect(snoozeOf(awake!)).toBeNull()
      })
    ))

  test("a deck of another Learner is not found", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token } = yield* signedIn("AAAAAAA1")
        const other = yield* signedIn("AAAAAAA2")
        const theirs = yield* seedDeck(other.id, wordList(4))
        yield* snooze(other.token, [theirs.deckSlug], null)

        const error = yield* unsnooze(token, [theirs.deckSlug]).pipe(Effect.flip)

        expect(error._tag).toBe("NotFound")
        expect(yield* listedSnooze(other.token, theirs.deckSlug)).toEqual({ until: null })
      })
    ))
})

test("snoozing and unsnoozing never touch a card's due, stability or difficulty", () =>
  rt.runPromise(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const { id, token } = yield* signedIn("AAAAAAA1")
      const deck = yield* seedDeck(id, wordList(4))
      yield* seedCard(id, deck.words[0]!.id, "term_meaning", { due: "2026-11-13T04:00:00Z", stability: 4.5, difficulty: 6.25 })

      const cards = () => sql`SELECT due, stability, difficulty, last_review, reps, lapses FROM cards ORDER BY id`
      const before = yield* cards()

      yield* snooze(token, [deck.deckSlug], 7)
      yield* unsnooze(token, [deck.deckSlug])
      yield* snooze(token, [deck.deckSlug], null)

      expect(yield* cards()).toEqual(before)
    })
  ))
