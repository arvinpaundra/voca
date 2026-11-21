import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { DateTime, Effect } from "effect"
import { at, call, makeIdentityRuntime } from "./identity.ts"
import { seedDeck, signedIn, wordList } from "./seed.ts"
import { resetDb } from "./setup.ts"

// The snooze on the deck responses that the snooze batch endpoints don't return: create, update and publish.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T10:00:00Z"))))

const snoozeDeck = (token: string, deckSlug: string) =>
  call((c) => c.library.snoozeDecks({ payload: { deckSlugs: [deckSlug] as never, days: 3 } }), token)

const snoozeOf = (deck: { readonly snooze?: { readonly until: DateTime.Utc | null } | null }) =>
  deck.snooze === undefined || deck.snooze === null
    ? null
    : { until: deck.snooze.until === null ? null : DateTime.formatIso(deck.snooze.until) }

describe("the snooze on the deck responses", () => {
  test("a new deck is awake", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token } = yield* signedIn("AAAAAAA1")

        const created = yield* call(
          (c) => c.library.createDeck({ payload: { title: "New", termLang: "ja", meaningLang: "en" } }),
          token
        )

        expect(snoozeOf(created)).toBeNull()
      })
    ))

  test("updating a snoozed deck keeps its snooze", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const deck = yield* seedDeck(id, wordList(4))
        yield* snoozeDeck(token, deck.deckSlug)

        const updated = yield* call(
          (c) => c.library.updateDeck({ params: { deckSlug: deck.deckSlug as never }, payload: { title: "Renamed" } }),
          token
        )

        expect(updated.title).toBe("Renamed")
        expect(snoozeOf(updated)).toEqual({ until: "2026-11-17T04:00:00.000Z" })
      })
    ))

  test("publishing a snoozed deck keeps its snooze", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const deck = yield* seedDeck(id, wordList(4))
        yield* snoozeDeck(token, deck.deckSlug)

        const published = yield* call(
          (c) => c.library.publishDeck({ params: { deckSlug: deck.deckSlug as never } }),
          token
        )

        expect(published.visibility).toBe("public")
        expect(snoozeOf(published)).toEqual({ until: "2026-11-17T04:00:00.000Z" })
      })
    ))
})
