import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { SqlClient } from "effect/sql"
import { at, call, makeIdentityRuntime } from "./identity.ts"
import { seedDeck, signedIn, wordList } from "./seed.ts"
import { resetDb } from "./setup.ts"

// Deleting the library selection: each deck goes as a single delete does, and the ones that can't go are listed.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T10:00:00Z"))))

const deleteDecks = (token: string, deckSlugs: ReadonlyArray<string>) =>
  call((c) => c.library.deleteDecks({ payload: { deckSlugs: deckSlugs as never } }), token)

const publish = (deckId: bigint) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`UPDATE decks SET visibility = 'public', published_at = '2026-11-02T00:00:00Z' WHERE id = ${deckId}`
  })

const liveRows = (table: "decks" | "words") =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql<{ readonly n: number }>`SELECT count(*)::int AS n FROM ${sql(table)} WHERE deleted_at IS NULL`
    return rows[0]!.n
  })

describe("POST /decks/delete", () => {
  test("deletes every selected deck with its words, from the library and Community", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const a = yield* seedDeck(id, wordList(2), { title: "A" })
        const b = yield* seedDeck(id, wordList(2), { title: "B" })
        const c = yield* seedDeck(id, wordList(2), { title: "C" })
        yield* publish(b.deckId)

        const result = yield* deleteDecks(token, [a.deckSlug, b.deckSlug, c.deckSlug])

        expect(result).toEqual({ failed: [] })
        expect(yield* call((c) => c.library.listDecks(), token)).toEqual([])
        expect((yield* call((c) => c.community.list({ query: {} }), token)).items).toEqual([])
        expect(yield* liveRows("decks")).toBe(0)
        expect(yield* liveRows("words")).toBe(0)
      })
    ))

  test("leaves the decks that were not selected", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("AAAAAAA1")
        const a = yield* seedDeck(id, wordList(1), { title: "A" })
        yield* seedDeck(id, wordList(1), { title: "Kept" })

        yield* deleteDecks(token, [a.deckSlug])

        const left = yield* call((c) => c.library.listDecks(), token)
        expect(left.map((deck) => deck.title)).toEqual(["Kept"])
      })
    ))

  test("lists a missing, an already deleted and another Learner's deck as failed, and deletes the rest", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("AAAAAAA1")
        const bob = yield* signedIn("AAAAAAA2")
        const mine = yield* seedDeck(ada.id, wordList(1), { title: "Mine" })
        const gone = yield* seedDeck(ada.id, wordList(1), { title: "Gone" })
        const bobs = yield* seedDeck(bob.id, wordList(1), { title: "Bob's" })
        yield* deleteDecks(ada.token, [gone.deckSlug])

        const result = yield* deleteDecks(ada.token, [mine.deckSlug, gone.deckSlug, bobs.deckSlug, "ZZZZZZZZZZ"])

        expect([...result.failed].map(String).sort()).toEqual([gone.deckSlug, bobs.deckSlug, "ZZZZZZZZZZ"].sort())
        expect(yield* call((c) => c.library.listDecks(), ada.token)).toEqual([])

        const bobsLeft = yield* call((c) => c.library.listDecks(), bob.token)
        expect(bobsLeft.map((deck) => deck.title)).toEqual(["Bob's"])
      })
    ))
})
