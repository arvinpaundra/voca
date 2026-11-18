import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { SqlClient } from "effect/sql"
import { at, call, makeIdentityRuntime } from "./identity.ts"
import { seedCard, seedDeck, signedIn, wordList } from "./seed.ts"
import { resetDb } from "./setup.ts"

// GET /decks/:deckSlug carries the deck's counts, the same numbers the decks list shows for it.
// The clock is 2026-11-14T00:00Z.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T00:00:00Z"))))

const getDeck = (token: string, deckSlug: string) =>
  call((c) => c.library.getDeck({ params: { deckSlug: deckSlug as never } }), token)

const listDecks = (token: string) => call((c) => c.library.listDecks(), token)

describe("GET /decks/:deckSlug counts", () => {
  test("word and due counts match the decks list; deleted words don't count", async () => {
    await rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        const deck = yield* seedDeck(ada.id, wordList(4))
        const sql = yield* SqlClient.SqlClient

        // Two drills of one word are due, another word is due later, one word is deleted.
        yield* seedCard(ada.id, deck.words[0]!.id, "term_meaning", { due: "2026-11-13T12:00:00Z" })
        yield* seedCard(ada.id, deck.words[0]!.id, "meaning_term", { due: "2026-11-13T12:00:00Z" })
        yield* seedCard(ada.id, deck.words[1]!.id, "term_meaning", { due: "2026-11-25T00:00:00Z" })
        yield* sql`UPDATE words SET deleted_at = now() WHERE id = ${deck.words[3]!.id}`

        const detail = yield* getDeck(ada.token, deck.deckSlug)
        const summary = (yield* listDecks(ada.token)).find((d) => String(d.slug) === deck.deckSlug)!

        expect(detail.wordCount).toBe(3)
        expect(detail.dueCount).toBe(2)
        expect(detail.wordCount).toBe(summary.wordCount)
        expect(detail.dueCount).toBe(summary.dueCount)
        expect(detail.title).toBe(deck.title)
      })
    )
  })

  test("an empty deck counts zero", async () => {
    await rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ADA00001")
        const deck = yield* seedDeck(ada.id, [])

        const detail = yield* getDeck(ada.token, deck.deckSlug)

        expect(detail.wordCount).toBe(0)
        expect(detail.dueCount).toBe(0)
      })
    )
  })
})
