import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect, Exit } from "effect"
import { SqlClient } from "effect/sql"
import type { DeckSlug, LearnerSlug } from "@voca/contract"
import { RefreshTokens, TokenSigner } from "../src/identity/application/ports.ts"
import { at, call, googleStub, makeIdentityRuntime } from "./identity.ts"
import { seedCard, seedDeck, seedReview, signedIn, wordList } from "./seed.ts"
import { resetDb } from "./setup.ts"

const ADA = { sub: "google-ada", email: "ada@example.com", name: "Ada Lovelace", avatarUrl: "https://example.com/ada.png" }

const rt = makeIdentityRuntime(googleStub({ ada: ADA }))
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-28T09:00:00Z"))))

const deleteAccount = (token: string) => call((c) => c.me.delete(), token)

const signInWithGoogle = () =>
  call((c) =>
    c.auth.google({
      payload: {
        code: "ada",
        codeVerifier: "v".repeat(43),
        redirectUri: "http://localhost:5173/auth/callback",
        timezone: "Asia/Jakarta"
      }
    })
  )

const issueRefresh = (learnerId: bigint) =>
  RefreshTokens.pipe(
    Effect.flatMap((tokens) => tokens.issue(learnerId)),
    Effect.map((issued) => issued.token)
  )

const refreshTag = (refreshToken: string) =>
  call((c) => c.auth.refresh({ payload: { refreshToken } })).pipe(
    Effect.flip,
    Effect.map((error) => error._tag)
  )

const meTag = (token: string) =>
  call((c) => c.me.get(), token).pipe(
    Effect.flip,
    Effect.map((error) => error._tag)
  )

const publish = (deckId: bigint) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    yield* sql`UPDATE decks SET visibility = 'public', published_at = '2026-11-02T00:00:00Z' WHERE id = ${deckId}`
  })

const liveDecksOf = (learnerId: bigint) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const [row] = yield* sql<{ readonly n: number }>`
      SELECT count(*)::int AS n FROM decks WHERE owner_id = ${learnerId} AND deleted_at IS NULL`

    return row!.n
  })

const seedPendingImport = (learnerId: bigint) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const [batch] = yield* sql<{ readonly id: string }>`
      INSERT INTO import_batches (slug, learner_id, term_lang, meaning_lang, created_at, dismissed_at)
      VALUES ('PENDNGBATCH00001', ${learnerId}, 'ja', 'en', '2026-11-28T08:00:00Z', NULL)
      RETURNING id::text AS id`

    yield* sql`
      INSERT INTO import_files (batch_id, position, name, content, status, deck_id, imported, skipped_duplicates,
        errors, total_errors)
      VALUES (${batch!.id}, 0, 'Verbs.csv', ${new TextEncoder().encode("term,meaning\n食べる,to eat\n")}, 'pending',
        NULL, 0, 0, '[]'::jsonb, 0)`
  })

const failLearnerUpdates = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE OR REPLACE FUNCTION test_fail_learner_update() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'learner update refused by the test';
    END;
    $$ LANGUAGE plpgsql`

  yield* sql`
    CREATE TRIGGER test_fail_learner_update BEFORE UPDATE ON learners
    FOR EACH ROW EXECUTE FUNCTION test_fail_learner_update()`
})

const allowLearnerUpdates = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`DROP TRIGGER IF EXISTS test_fail_learner_update ON learners`
  yield* sql`DROP FUNCTION IF EXISTS test_fail_learner_update()`
}).pipe(Effect.orDie)

describe("DELETE /me", () => {
  test("204, then the access token, a freshly signed one and every device's refresh token are refused", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ABCDEFGH")
        const laptop = yield* issueRefresh(ada.id)
        const phone = yield* issueRefresh(ada.id)

        yield* deleteAccount(ada.token)

        expect(yield* meTag(ada.token)).toBe("Unauthorized")

        const signer = yield* TokenSigner
        const fresh = yield* signer.sign("ABCDEFGH" as LearnerSlug)
        expect(yield* meTag(fresh.token)).toBe("Unauthorized")

        expect(yield* refreshTag(laptop)).toBe("RefreshTokenInvalid")
        expect(yield* refreshTag(phone)).toBe("RefreshTokenInvalid")
      })
    ))

  test("every deck leaves the library and Community, and another Learner's fork keeps its words and progress", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ABCDEFGH")
        const bob = yield* signedIn("BCDEFGHJ")
        const shared = yield* seedDeck(ada.id, wordList(2), { title: "Shared verbs" })
        const kept = yield* seedDeck(ada.id, wordList(1), { title: "Private nouns" })
        yield* publish(shared.deckId)

        const fork = yield* seedDeck(bob.id, wordList(2), { title: "Shared verbs" })
        const sql = yield* SqlClient.SqlClient
        yield* sql`UPDATE decks SET forked_from_id = ${shared.deckId} WHERE id = ${fork.deckId}`
        yield* seedCard(bob.id, fork.words[0]!.id, "term_meaning", { due: "2026-11-30T00:00:00Z", reps: 4 })
        yield* seedCard(bob.id, fork.words[1]!.id, "term_meaning", { due: "2026-12-01T00:00:00Z", reps: 2 })

        yield* deleteAccount(ada.token)

        expect(yield* liveDecksOf(ada.id)).toBe(0)

        const page = yield* call((c) => c.community.list({ query: {} }), bob.token)
        expect(page.items.map((deck) => String(deck.slug))).not.toContain(shared.deckSlug)

        const missing = yield* call(
          (c) => c.community.get({ params: { deckSlug: shared.deckSlug as DeckSlug } }),
          bob.token
        ).pipe(Effect.flip)
        expect(missing._tag).toBe("NotFound")

        const privateMissing = yield* call(
          (c) => c.community.get({ params: { deckSlug: kept.deckSlug as DeckSlug } }),
          bob.token
        ).pipe(Effect.flip)
        expect(privateMissing._tag).toBe("NotFound")

        const forked = yield* call((c) => c.library.getDeck({ params: { deckSlug: fork.deckSlug as DeckSlug } }), bob.token)
        expect(forked.forkedFrom).toEqual({ slug: shared.deckSlug as DeckSlug, title: "Shared verbs", deleted: true })
        expect(forked.wordCount).toBe(2)

        const [cards] = yield* sql<{ readonly n: number }>`
          SELECT count(*)::int AS n FROM cards WHERE learner_id = ${bob.id} AND deleted_at IS NULL`
        expect(cards!.n).toBe(2)
      })
    ))

  test("the stored account keeps no name, email, photo or Google ID, and its review history stays", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ABCDEFGH")
        const sql = yield* SqlClient.SqlClient
        yield* sql`UPDATE learners SET avatar_url = 'https://example.com/ada.png' WHERE id = ${ada.id}`

        const deck = yield* seedDeck(ada.id, wordList(1))
        yield* seedReview(ada.id, deck.words[0]!.id, "term_meaning", { at: "2026-11-27T10:00:00Z", correct: true })
        yield* seedReview(ada.id, deck.words[0]!.id, "meaning_term", { at: "2026-11-27T10:01:00Z", correct: false })

        yield* deleteAccount(ada.token)

        const [stored] = yield* sql<{
          readonly email: string | null
          readonly name: string | null
          readonly avatarUrl: string | null
          readonly googleSub: string | null
          readonly deleted: boolean
        }>`
          SELECT email, name, avatar_url AS "avatarUrl", google_sub AS "googleSub", deleted_at IS NOT NULL AS deleted
          FROM learners WHERE id = ${ada.id}`
        expect(stored).toEqual({ email: "", name: "", avatarUrl: null, googleSub: "", deleted: true })

        const [reviews] = yield* sql<{ readonly n: number }>`
          SELECT count(*)::int AS n FROM reviews WHERE learner_id = ${ada.id}`
        expect(reviews!.n).toBe(2)
      })
    ))

  test("a pending import is failed with its file contents cleared, and creates no deck", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ABCDEFGH")
        yield* seedPendingImport(ada.id)

        yield* deleteAccount(ada.token)

        const sql = yield* SqlClient.SqlClient
        const [file] = yield* sql<{ readonly status: string; readonly cleared: boolean; readonly deckId: string | null }>`
          SELECT status, content IS NULL AS cleared, deck_id::text AS "deckId" FROM import_files`
        expect(file).toEqual({ status: "failed", cleared: true, deckId: null })
        expect(yield* liveDecksOf(ada.id)).toBe(0)
      })
    ))

  test("signing in again with the same Google account starts a new, empty account with default settings", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const first = yield* signInWithGoogle()
        yield* call(
          (c) =>
            c.me.updateSettings({
              payload: { newPerDay: 50, defaultSessionSize: 20, defaultMode: "hard", dayStartHour: 0 }
            }),
          first.accessToken
        )
        yield* call(
          (c) =>
            c.library.createDeck({
              payload: { title: "Verbs", description: "", termLang: "ja", meaningLang: "en" }
            }),
          first.accessToken
        )

        yield* deleteAccount(first.accessToken)

        const again = yield* signInWithGoogle()
        expect(again.learner.slug).not.toBe(first.learner.slug)
        expect(again.learner).toMatchObject({ email: ADA.email, name: ADA.name, avatarUrl: ADA.avatarUrl })
        expect(again.learner.settings).toEqual({
          timezone: "Asia/Jakarta",
          dayStartHour: 4,
          desiredRetention: 0.9,
          newPerDay: 20,
          defaultSessionSize: 10,
          defaultMode: "easy"
        })

        const decks = yield* call((c) => c.library.listDecks({ query: {} }), again.accessToken)
        expect(decks.total).toBe(0)
      })
    ))

  test("only the caller's account changes", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ABCDEFGH")
        const bob = yield* signedIn("BCDEFGHJ")
        const bobRefresh = yield* issueRefresh(bob.id)
        yield* seedDeck(bob.id, wordList(1))

        yield* deleteAccount(ada.token)

        const me = yield* call((c) => c.me.get(), bob.token)
        expect(me).toMatchObject({ slug: "BCDEFGHJ", email: "bcdefghj@example.com", name: "Learner BCDEFGHJ" })
        expect(yield* liveDecksOf(bob.id)).toBe(1)

        const rotated = yield* call((c) => c.auth.refresh({ payload: { refreshToken: bobRefresh } }))
        expect(rotated.refreshToken).not.toBe(bobRefresh)
      })
    ))

  test("a delete that fails part-way changes nothing: the account still signs in and owns all its decks", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ABCDEFGH")
        const refreshToken = yield* issueRefresh(ada.id)
        const deck = yield* seedDeck(ada.id, wordList(2))
        yield* publish(deck.deckId)
        yield* seedDeck(ada.id, wordList(1))
        yield* seedPendingImport(ada.id)

        yield* failLearnerUpdates
        const outcome = yield* deleteAccount(ada.token).pipe(Effect.exit, Effect.ensuring(allowLearnerUpdates))
        expect(Exit.isFailure(outcome)).toBe(true)

        const me = yield* call((c) => c.me.get(), ada.token)
        expect(me).toMatchObject({ slug: "ABCDEFGH", email: "abcdefgh@example.com", name: "Learner ABCDEFGH" })
        expect(yield* liveDecksOf(ada.id)).toBe(2)

        const sql = yield* SqlClient.SqlClient
        const [file] = yield* sql<{ readonly status: string; readonly cleared: boolean }>`
          SELECT status, content IS NULL AS cleared FROM import_files`
        expect(file).toEqual({ status: "pending", cleared: false })

        const page = yield* call((c) => c.community.list({ query: {} }), ada.token)
        expect(page.items.map((item) => String(item.slug))).toContain(deck.deckSlug)

        const rotated = yield* call((c) => c.auth.refresh({ payload: { refreshToken } }))
        expect(rotated.refreshToken).not.toBe(refreshToken)
      })
    ))
})
