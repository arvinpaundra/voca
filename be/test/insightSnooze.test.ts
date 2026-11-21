import { afterAll, beforeEach, expect, test } from "bun:test"
import { Effect } from "effect"
import { SqlClient } from "effect/sql"
import { TokenSigner } from "../src/identity/application/ports.ts"
import { at, call, makeIdentityRuntime } from "./identity.ts"
import { seedCard, seedDeck, signedIn, wordList } from "./seed.ts"
import { resetDb } from "./setup.ts"

// A snooze leaves the notification panel's counts only. The deck's own stats keep counting it.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T10:00:00Z"))))

const OVERDUE = "2026-11-12T04:00:00Z"

const deckStats = (token: string, deckSlug: string) =>
  call((c) => c.insight.deckStats({ params: { deckSlug: deckSlug as never } }), token)

const snoozeDeck = (deckId: bigint) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    yield* sql`UPDATE decks SET snoozed_at = '2026-11-14T09:00:00Z', snoozed_until = NULL WHERE id = ${deckId}`
  })

test("deck stats of a snoozed deck count it as before", () =>
  rt.runPromise(
    Effect.gen(function* () {
      const { id, token } = yield* signedIn("AAAAAAA1")
      const sleepy = yield* seedDeck(id, wordList(3, "眠"), { title: "Sleepy" })

      yield* seedCard(id, sleepy.words[0]!.id, "term_meaning", { due: OVERDUE })

      const before = yield* deckStats(token, sleepy.deckSlug)
      expect(before.overdue).toBe(1)

      yield* snoozeDeck(sleepy.deckId)

      expect(yield* deckStats(token, sleepy.deckSlug)).toEqual(before)
    })
  ))
