import { Effect } from "effect"
import { SqlClient } from "effect/sql"
import { ALPHABET, type Drill } from "@voca/contract"
import { TokenSigner } from "../src/identity/application/ports.ts"
import { normalizeKey } from "../src/library/domain/text.ts"
import { seedLearner } from "./identity.ts"

// SQL seeding for the word page and Hard Words tests: decks, words, cards, reviews and session questions,
// so no test depends on another task's endpoints.

let serial = 0

/** A fresh slug of the given length, valid in the Crockford alphabet. */
export const nextSlug = (length: number) =>
  (++serial)
    .toString(32)
    .padStart(length, "0")
    .split("")
    .map((digit) => ALPHABET[parseInt(digit, 32)])
    .join("")

/** Seeds a Learner (UTC, dayStartHour 4) and returns their id and an access token. */
export const signedIn = (slug: string) =>
  Effect.gen(function* () {
    const id = yield* seedLearner(slug)
    const signer = yield* TokenSigner
    const token = (yield* signer.sign(slug as never)).token
    return { id, token }
  })

export type NewWord = { readonly term: string; readonly meaning: string; readonly reading?: string }

export type SeededWord = NewWord & { readonly id: bigint; readonly slug: string }

/** `count` words with distinct terms, readings and meanings. */
export const wordList = (count: number, prefix = "語"): Array<NewWord> =>
  Array.from({ length: count }, (_, i) => ({ term: `${prefix}${i}`, meaning: `${prefix} meaning ${i}`, reading: `ご${prefix}${i}` }))

/** A deck owned by `ownerId` with its words, added one second apart. */
export const seedDeck = (
  ownerId: bigint,
  list: ReadonlyArray<NewWord>,
  options: { readonly title?: string; readonly termLang?: string } = {}
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const deckSlug = nextSlug(10)
    const title = options.title ?? "Deck"
    const termLang = options.termLang ?? "ja"

    const [deck] = yield* sql<{ readonly id: string }>`
      INSERT INTO decks (slug, owner_id, title, description, term_lang, meaning_lang, visibility, fork_count,
        created_at, updated_at)
      VALUES (${deckSlug}, ${ownerId}, ${title}, '', ${termLang}, 'en', 'private', 0,
        '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z')
      RETURNING id::text AS id`

    const seeded: Array<SeededWord> = []

    for (const [i, word] of list.entries()) {
      const slug = nextSlug(12)

      const [row] = yield* sql<{ readonly id: string }>`
        INSERT INTO words (slug, deck_id, term, reading, meaning, term_key, reading_key, meaning_key, created_at)
        VALUES (${slug}, ${deck!.id}, ${word.term}, ${word.reading ?? null}, ${word.meaning},
          ${normalizeKey(word.term)}, ${normalizeKey(word.reading ?? "")}, ${normalizeKey(word.meaning)},
          ${new Date(Date.parse("2026-11-01T00:00:00Z") + i * 1000)})
        RETURNING id::text AS id`

      seeded.push({ ...word, id: BigInt(row!.id), slug })
    }

    return { deckSlug, deckId: BigInt(deck!.id), title, termLang, words: seeded }
  })

export type CardSeed = {
  readonly due: string
  readonly stability?: number
  readonly difficulty?: number
  readonly lastReview?: string
  readonly reps?: number
  readonly lapses?: number
  readonly hard?: boolean
}

export const seedCard = (learnerId: bigint, wordId: bigint, drill: Drill, card: CardSeed) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    yield* sql`
      INSERT INTO cards (word_id, drill, learner_id, stability, difficulty, due, last_review, reps, lapses, is_hard)
      VALUES (${wordId}, ${drill}, ${learnerId}, ${card.stability ?? 10}, ${card.difficulty ?? 5},
        ${new Date(card.due)}, ${new Date(card.lastReview ?? "2026-11-01T00:00:00Z")},
        ${card.reps ?? 3}, ${card.lapses ?? 0}, ${card.hard ?? false})`
  })

export type ReviewSeed = {
  readonly at: string
  readonly correct: boolean
  readonly rating?: 1 | 2 | 3 | 4
  readonly mode?: "easy" | "hard"
  readonly latencyMs?: number
  readonly stateBefore?: "new" | "review"
  readonly retrievability?: number | null
  readonly scheduledDays?: number
  readonly chosenWordId?: bigint | null
}

/** One first attempt in `reviews` (what accuracy, streak, latency and history are computed from). */
export const seedReview = (learnerId: bigint, wordId: bigint, drill: Drill, review: ReviewSeed) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    yield* sql`
      INSERT INTO reviews (word_id, drill, learner_id, reviewed_at, rating, correct, mode, latency_ms, chosen_word_id,
        state_before, retrievability, stability_after, difficulty_after, scheduled_days)
      VALUES (${wordId}, ${drill}, ${learnerId}, ${new Date(review.at)}, ${review.rating ?? (review.correct ? 3 : 1)},
        ${review.correct}, ${review.mode ?? "easy"}, ${review.latencyMs ?? 2000}, ${review.chosenWordId ?? null},
        ${review.stateBefore ?? "review"}, ${review.retrievability ?? null}, 10, 5, ${review.scheduledDays ?? 3})`
  })

/** A finished session holding the given attempts of `wordId` (what "confused with" and attempts-to-clear read). */
export const seedSessionAttempts = (
  learnerId: bigint,
  wordId: bigint,
  drill: Drill,
  attempts: ReadonlyArray<{ readonly correct: boolean; readonly chosenWordId: bigint }>,
  endedAt: string
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const [session] = yield* sql<{ readonly id: string }>`
      INSERT INTO study_sessions (slug, learner_id, scope_deck_id, drills, mode, size, status, created_at, ended_at)
      VALUES (${nextSlug(14)}, ${learnerId}, NULL, ${[drill]}, 'easy', 7, 'completed', ${new Date(endedAt)}, ${new Date(endedAt)})
      RETURNING id::text AS id`

    for (const [i, attempt] of attempts.entries()) {
      yield* sql`
        INSERT INTO session_questions (session_id, position, word_id, drill, attempt, option_ids, answered_at,
          chosen_word_id, correct, latency_ms)
        VALUES (${session!.id}, ${i + 1}, ${wordId}, ${drill}, ${i + 1}, ${[wordId, attempt.chosenWordId]},
          ${new Date(endedAt)}, ${attempt.chosenWordId}, ${attempt.correct}, 2000)`
    }
  })
