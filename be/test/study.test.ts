import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { DateTime, Effect } from "effect"
import { SqlClient } from "effect/sql"
import { ALPHABET, type Drill, type Question } from "@voca/contract"
import { TokenSigner } from "../src/identity/application/ports.ts"
import { normalizeKey } from "../src/library/domain/text.ts"
import { at, call, makeIdentityRuntime, seedLearner } from "./identity.ts"
import { resetDb } from "./setup.ts"
import vectors from "./fixtures/fsrs-vectors.json"

// Study sessions over HTTP. Decks, words, cards and reviews are seeded with SQL.
// The clock is 2026-11-14T00:00Z and Learners are in UTC with dayStartHour 4,
// so today's study day runs from 2026-11-13T04:00Z to 2026-11-14T04:00Z.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T00:00:00Z"))))

const TODAY_START = "2026-11-13T04:00:00Z"

let serial = 0

/** A fresh slug of the given length, valid in the Crockford alphabet. */
const nextSlug = (length: number) =>
  (++serial)
    .toString(32)
    .padStart(length, "0")
    .split("")
    .map((digit) => ALPHABET[parseInt(digit, 32)])
    .join("")

const signedIn = (slug: string) =>
  Effect.gen(function* () {
    const id = yield* seedLearner(slug)
    const signer = yield* TokenSigner
    const token = (yield* signer.sign(slug as never)).token
    return { id, token }
  })

type NewWord = { readonly term: string; readonly meaning: string; readonly reading?: string }

type SeededWord = NewWord & { readonly id: bigint; readonly slug: string }

/** `count` words with distinct terms, readings and meanings: every drill applies to each, unless `withReading` is false. */
const words = (count: number, withReading = true): Array<NewWord> =>
  Array.from({ length: count }, (_, i) => ({
    term: `語${i}`,
    meaning: `meaning ${i}`,
    ...(withReading ? { reading: `ご${i}` } : {})
  }))

/** A deck owned by `ownerId`, with its words added in order, one second apart. */
const seedDeck = (ownerId: bigint, list: ReadonlyArray<NewWord>, termLang = "ja") =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const deckSlug = nextSlug(10)

    const [deck] = yield* sql<{ readonly id: string }>`
      INSERT INTO decks (slug, owner_id, title, description, term_lang, meaning_lang, visibility, fork_count,
        created_at, updated_at)
      VALUES (${deckSlug}, ${ownerId}, 'Deck', '', ${termLang}, 'en', 'private', 0,
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

    return { deckSlug, deckId: BigInt(deck!.id), words: seeded }
  })

type CardSeed = {
  readonly due: string
  readonly stability?: number
  readonly difficulty?: number
  readonly lastReview?: string
  readonly reps?: number
  readonly lapses?: number
}

const seedCard = (learnerId: bigint, wordId: bigint, drill: Drill, card: CardSeed) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    yield* sql`
      INSERT INTO cards (word_id, drill, learner_id, stability, difficulty, due, last_review, reps, lapses, is_hard)
      VALUES (${wordId}, ${drill}, ${learnerId}, ${card.stability ?? 10}, ${card.difficulty ?? 5},
        ${new Date(card.due)}, ${new Date(card.lastReview ?? "2026-11-01T00:00:00Z")},
        ${card.reps ?? 3}, ${card.lapses ?? 0}, false)`
  })

/** A first-ever review (state_before 'new') at `reviewedAt`: it counts toward that study day's new-card target. */
const seedNewReview = (learnerId: bigint, wordId: bigint, reviewedAt: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    yield* sql`
      INSERT INTO reviews (word_id, drill, learner_id, reviewed_at, rating, correct, mode, latency_ms, state_before,
        stability_after, difficulty_after, scheduled_days)
      VALUES (${wordId}, 'term_meaning', ${learnerId}, ${new Date(reviewedAt)}, 3, true, 'easy', 2000, 'new',
        2.3065, 2.1181, 2)`
  })

const setNewPerDay = (learnerId: bigint, newPerDay: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`UPDATE learners SET new_per_day = ${newPerDay} WHERE id = ${learnerId}`
  })

const deckDrills = (token: string, deckSlug: string) =>
  call((c) => c.study.deckDrills({ params: { deckSlug: deckSlug as never } }), token)

type Start = { drills?: ReadonlyArray<Drill>; size?: 7 | 10 | 15 | 20 }

const start = (token: string, deckSlug: string, options: Start = {}) =>
  call(
    (c) =>
      c.study.start({
        payload: {
          scope: { kind: "deck", deckSlug: deckSlug as never },
          drills: (options.drills ?? ["term_meaning"]) as never,
          size: options.size ?? 7,
          mode: "easy"
        }
      }),
    token
  )

const active = (token: string) => call((c) => c.study.active(), token)

const abandon = (token: string, sessionSlug: string) =>
  call((c) => c.study.abandon({ params: { sessionSlug: sessionSlug as never } }), token)

const answer = (token: string, sessionSlug: string, position: number, chosenWordSlug: string, latencyMs = 2000) =>
  call(
    (c) =>
      c.study.answer({
        params: { sessionSlug: sessionSlug as never },
        payload: { position, chosenWordSlug: chosenWordSlug as never, latencyMs }
      }),
    token
  )

const answerRight = (token: string, sessionSlug: string, question: Question, latencyMs = 2000) =>
  answer(token, sessionSlug, question.position, String(question.wordSlug), latencyMs)

const answerWrong = (token: string, sessionSlug: string, question: Question) => {
  const wrong = question.options.find((option) => option.wordSlug !== question.wordSlug)!
  return answer(token, sessionSlug, question.position, String(wrong.wordSlug))
}

const slugsOf = (questions: ReadonlyArray<Question>) => questions.map((question) => String(question.wordSlug))

const iso = (instant: DateTime.Utc) => DateTime.formatIso(instant)

const cardOf = (wordId: bigint, drill: Drill) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const [card] = yield* sql<{ stability: number; difficulty: number; due: Date; reps: number; lapses: number }>`
      SELECT stability, difficulty, due, reps, lapses FROM cards WHERE word_id = ${wordId} AND drill = ${drill}`

    return card
  })

const reviewsOf = (wordId: bigint) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    return yield* sql<{ rating: number; correct: boolean; state_before: string; stability_before: number | null }>`
      SELECT rating, correct, state_before, stability_before FROM reviews WHERE word_id = ${wordId}`
  })

const sessionStatus = (sessionSlug: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const [row] = yield* sql<{ status: string }>`SELECT status FROM study_sessions WHERE slug = ${sessionSlug}`
    return row!.status
  })

describe("GET /decks/:deckSlug/drills", () => {
  test("lists the drills that apply, in a fixed order, with today's due and new counts", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, [...words(3), ...words(5, false).slice(3)])
        const [w0, w1] = deck.words

        yield* seedCard(id, w0!.id, "term_meaning", { due: TODAY_START })
        yield* seedCard(id, w1!.id, "term_meaning", { due: "2026-11-20T04:00:00Z" })
        yield* seedCard(id, w0!.id, "reading_term", { due: "2026-11-14T03:59:59Z" })

        const drills = yield* deckDrills(token, deck.deckSlug)

        expect(drills).toEqual([
          { drill: "term_meaning", label: "Word → Meaning", due: 1, new: 3 },
          { drill: "meaning_term", label: "Meaning → Word", due: 0, new: 5 },
          { drill: "term_reading", label: "Word → Kana", due: 0, new: 3 },
          { drill: "reading_term", label: "Kana → Word", due: 1, new: 2 }
        ])
      })
    ))

  test("a deck where no reading differs from its term lists only the meaning drills", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, [
          { term: "ありがとう", reading: "ありがとう", meaning: "thank you" },
          { term: "はい", meaning: "yes" }
        ])

        const drills = yield* deckDrills(token, deck.deckSlug)

        expect(drills.map((drill) => drill.drill)).toEqual(["term_meaning", "meaning_term"])
      })
    ))

  test("new counts are the words with no card in the drill, whatever the daily target", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(6, false))
        const other = yield* seedDeck(id, words(2, false))

        yield* setNewPerDay(id, 1)
        yield* seedNewReview(id, other.words[0]!.id, "2026-11-13T05:00:00Z")
        yield* seedNewReview(id, other.words[1]!.id, "2026-11-13T03:00:00Z") // yesterday's study day

        const drills = yield* deckDrills(token, deck.deckSlug)

        expect(drills.map((drill) => drill.new)).toEqual([6, 6])
      })
    ))

  test("someone else's deck answers NotFound", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ABCDEFGH")
        const bob = yield* signedIn("JKMNPQRS")
        const deck = yield* seedDeck(ada.id, words(4))

        const error = yield* deckDrills(bob.token, deck.deckSlug).pipe(Effect.flip)

        expect(error._tag).toBe("NotFound")
      })
    ))
})

describe("POST /sessions", () => {
  test("starts a session of distinct words, each with 4 distinct options from its deck", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(12))
        const bySlug = new Map(deck.words.map((word) => [word.slug, word]))

        const session = yield* start(token, deck.deckSlug)

        expect(String(session.slug)).toMatch(/^[0-9A-HJKMNP-TV-Z]{14}$/)
        expect(session).toMatchObject({
          drills: ["term_meaning"],
          termLang: "ja",
          mode: "easy",
          size: 7,
          status: "active",
          cleared: 0
        })
        expect(session.questions.map((question) => question.position)).toEqual([1, 2, 3, 4, 5, 6, 7])
        expect(new Set(slugsOf(session.questions)).size).toBe(7)

        for (const question of session.questions) {
          const word = bySlug.get(String(question.wordSlug))!
          const optionSlugs = question.options.map((option) => String(option.wordSlug))

          expect(question).toMatchObject({
            attempt: 1,
            drill: "term_meaning",
            drillLabel: "Word → Meaning",
            prompt: { text: word.term, ruby: null }
          })
          expect(new Set(optionSlugs).size).toBe(4)
          expect(optionSlugs).toContain(word.slug)

          for (const option of question.options) {
            expect(option.text).toBe(bySlug.get(String(option.wordSlug))!.meaning)
          }
        }
      })
    ))

  test("due words come first, most overdue first; new words fill the rest", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(12))
        const due = deck.words.slice(0, 9)

        for (const [i, word] of due.entries()) {
          yield* seedCard(id, word.id, "term_meaning", { due: `2026-11-0${i + 1}T04:00:00Z` })
        }

        const session = yield* start(token, deck.deckSlug)

        expect(new Set(slugsOf(session.questions))).toEqual(new Set(due.slice(0, 7).map((word) => word.slug)))
      })
    ))

  test("past the daily target, new words still fill the session up to its size", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(10))
        const [dueWord] = deck.words

        yield* setNewPerDay(id, 1)
        yield* seedNewReview(id, deck.words[9]!.id, "2026-11-13T05:00:00Z")
        yield* seedCard(id, dueWord!.id, "term_meaning", { due: TODAY_START })

        const session = yield* start(token, deck.deckSlug)

        expect(session.size).toBe(7)
        expect(session.questions).toHaveLength(7)
        expect(slugsOf(session.questions)).toContain(dueWord!.slug)
      })
    ))

  test("a mixed session asks each word in one drill only, with that drill's prompt and options", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(8))
        const bySlug = new Map(deck.words.map((word) => [word.slug, word]))
        const [w0] = deck.words

        yield* seedCard(id, w0!.id, "term_meaning", { due: TODAY_START })
        yield* seedCard(id, w0!.id, "reading_term", { due: TODAY_START })

        const session = yield* start(token, deck.deckSlug, { drills: ["term_meaning", "reading_term"] })

        expect(session.questions).toHaveLength(7)
        expect(new Set(slugsOf(session.questions)).size).toBe(7)
        expect(new Set(session.questions.map((question) => question.drill))).toEqual(
          new Set(["term_meaning", "reading_term"])
        )

        for (const question of session.questions.filter((question) => question.drill === "reading_term")) {
          const word = bySlug.get(String(question.wordSlug))!

          expect(question.drillLabel).toBe("Kana → Word")
          expect(question.prompt).toEqual({ text: word.reading!, ruby: null })

          for (const option of question.options) {
            expect(option.text).toBe(bySlug.get(String(option.wordSlug))!.term)
          }
        }
      })
    ))

  test("starting again abandons the active session", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(8))

        const first = yield* start(token, deck.deckSlug)
        const second = yield* start(token, deck.deckSlug)

        expect(yield* sessionStatus(String(first.slug))).toBe("abandoned")
        expect((yield* active(token))?.slug).toBe(second.slug)
      })
    ))

  test.each([
    ["fewer than 4 words", words(3)],
    [
      "fewer than 4 distinct answers",
      [...words(2), { term: "x", meaning: "same" }, { term: "y", meaning: "Same" }, { term: "z", meaning: "SAME " }]
    ]
  ])("a deck with %s answers DeckTooSmall", (_, list) =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, list)

        const error = yield* start(token, deck.deckSlug).pipe(Effect.flip)

        expect(error._tag).toBe("DeckTooSmall")
      })
    ))

  test("a drill that applies to no word answers DrillNotAvailable", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(6, false))

        const error = yield* start(token, deck.deckSlug, { drills: ["term_reading"] }).pipe(Effect.flip)

        expect(error._tag).toBe("DrillNotAvailable")
      })
    ))

  test("someone else's deck answers NotFound", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ABCDEFGH")
        const bob = yield* signedIn("JKMNPQRS")
        const deck = yield* seedDeck(ada.id, words(8))

        const error = yield* start(bob.token, deck.deckSlug).pipe(Effect.flip)

        expect(error._tag).toBe("NotFound")
      })
    ))
})

describe("POST /sessions/:sessionSlug/answers", () => {
  test.each([
    ["a quick right answer rates Good", 2000, 3, "2026-11-15T04:00:00.000Z"],
    ["a slow right answer rates Hard", 9000, 2, "2026-11-14T04:00:00.000Z"]
  ])("%s and creates the card", (_, latencyMs, rating, nextDue) =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(8))
        const bySlug = new Map(deck.words.map((word) => [word.slug, word]))
        const session = yield* start(token, deck.deckSlug)
        const question = session.questions[0]!
        const word = bySlug.get(String(question.wordSlug))!

        const result = yield* answerRight(token, String(session.slug), question, latencyMs)

        expect(result).toMatchObject({
          correct: true,
          correctWordSlug: question.wordSlug,
          retry: null,
          completed: false,
          leech: false
        })
        expect(iso(result.nextDue!)).toBe(nextDue)

        const card = yield* cardOf(word.id, "term_meaning")
        const initial = vectors.initial.find((vector) => vector.rating === rating)!

        expect(card!.stability).toBeCloseTo(initial.stability, 6)
        expect(card!.due.toISOString()).toBe(nextDue)
        expect(card).toMatchObject({ reps: 1, lapses: 0 })
        expect(yield* reviewsOf(word.id)).toEqual([
          { rating, correct: true, state_before: "new", stability_before: null }
        ])
      })
    ))

  test("a wrong answer is due next study day and comes back as a retry that doesn't reschedule", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(8))
        const bySlug = new Map(deck.words.map((word) => [word.slug, word]))
        const session = yield* start(token, deck.deckSlug)
        const question = session.questions[0]!
        const word = bySlug.get(String(question.wordSlug))!

        const wrong = yield* answerWrong(token, String(session.slug), question)

        expect(wrong).toMatchObject({ correct: false, correctWordSlug: question.wordSlug, completed: false })
        expect(iso(wrong.nextDue!)).toBe("2026-11-14T04:00:00.000Z")
        expect(wrong.retry).toMatchObject({
          position: 8,
          attempt: 2,
          wordSlug: question.wordSlug,
          drill: "term_meaning"
        })
        expect(new Set(wrong.retry!.options.map((option) => option.wordSlug)).size).toBe(4)
        expect(wrong.retry!.options.map((option) => option.wordSlug)).toContain(question.wordSlug)

        const right = yield* answerRight(token, String(session.slug), wrong.retry!)

        expect(right).toMatchObject({ correct: true, nextDue: null, retry: null })
        expect((yield* cardOf(word.id, "term_meaning"))!.stability).toBeCloseTo(vectors.initial[0]!.stability, 6)
        expect(yield* reviewsOf(word.id)).toHaveLength(1)
      })
    ))

  test("a lapse on a studied card updates its memory and flags a leech at 4 lapses", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(8))
        const [w0] = deck.words
        const vector = vectors.next.find(
          (v) => v.stability === 10 && v.difficulty === 5 && v.elapsedDays === 12 && v.rating === 1
        )!

        yield* seedCard(id, w0!.id, "term_meaning", {
          due: TODAY_START,
          stability: 10,
          difficulty: 5,
          lastReview: "2026-11-02T00:00:00Z",
          reps: 5,
          lapses: 3
        })

        const session = yield* start(token, deck.deckSlug)
        const question = session.questions.find((q) => q.wordSlug === (w0!.slug as never))!

        const result = yield* answerWrong(token, String(session.slug), question)
        const card = yield* cardOf(w0!.id, "term_meaning")

        expect(result.leech).toBe(true)
        expect(card).toMatchObject({ reps: 6, lapses: 4 })
        expect(card!.stability).toBeCloseTo(vector.after.stability, 6)
        expect(card!.difficulty).toBeCloseTo(vector.after.difficulty, 6)
        expect(card!.due.toISOString()).toBe(iso(result.nextDue!))
        expect(card!.due.getTime()).toBeGreaterThanOrEqual(Date.parse("2026-11-14T04:00:00Z"))
        expect(yield* reviewsOf(w0!.id)).toEqual([
          { rating: 1, correct: false, state_before: "review", stability_before: 10 }
        ])
      })
    ))

  test("answering every word right completes the session", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(4))
        const session = yield* start(token, deck.deckSlug)

        expect(session.questions).toHaveLength(4)

        const results = []

        for (const question of session.questions) {
          results.push(yield* answerRight(token, String(session.slug), question))
        }

        expect(results.map((result) => result.completed)).toEqual([false, false, false, true])
        expect(yield* sessionStatus(String(session.slug))).toBe("completed")
        expect(yield* active(token)).toBeNull()
      })
    ))

  test("refuses a second answer, an unknown position, another Learner, and an ended session", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ABCDEFGH")
        const bob = yield* signedIn("JKMNPQRS")
        const deck = yield* seedDeck(ada.id, words(8))
        const session = yield* start(ada.token, deck.deckSlug)
        const slug = String(session.slug)
        const [first, second] = session.questions

        yield* answerRight(ada.token, slug, first!)

        const twice = yield* answerRight(ada.token, slug, first!).pipe(Effect.flip)
        const unknown = yield* answer(ada.token, slug, 99, String(first!.wordSlug)).pipe(Effect.flip)
        const notTheirs = yield* answerRight(bob.token, slug, second!).pipe(Effect.flip)

        yield* abandon(ada.token, slug)

        const ended = yield* answerRight(ada.token, slug, second!).pipe(Effect.flip)

        expect(twice._tag).toBe("QuestionAlreadyAnswered")
        expect(unknown._tag).toBe("NotFound")
        expect(notTheirs._tag).toBe("NotFound")
        expect(ended._tag).toBe("SessionNotActive")
      })
    ))
})

describe("GET /sessions/active and POST /sessions/:sessionSlug/abandon", () => {
  test("no session: active is null", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { token } = yield* signedIn("ABCDEFGH")

        expect(yield* active(token)).toBeNull()
      })
    ))

  test("resumes with the pending questions in position order, retries included, and the cleared count", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(8))
        const session = yield* start(token, deck.deckSlug)
        const slug = String(session.slug)
        const [first, second, ...rest] = session.questions

        yield* answerRight(token, slug, first!)
        const wrong = yield* answerWrong(token, slug, second!)

        const resumed = yield* active(token)

        expect(resumed).toMatchObject({ slug: session.slug, status: "active", size: 7, cleared: 1 })
        expect(resumed!.questions.map((question) => question.position)).toEqual([
          ...rest.map((question) => question.position),
          wrong.retry!.position
        ])
        expect(resumed!.questions.at(-1)).toEqual(wrong.retry!)
      })
    ))

  test("abandon ends the session; another Learner's session answers NotFound", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const ada = yield* signedIn("ABCDEFGH")
        const bob = yield* signedIn("JKMNPQRS")
        const deck = yield* seedDeck(ada.id, words(8))
        const session = yield* start(ada.token, deck.deckSlug)

        const notTheirs = yield* abandon(bob.token, String(session.slug)).pipe(Effect.flip)

        yield* abandon(ada.token, String(session.slug))

        expect(notTheirs._tag).toBe("NotFound")
        expect(yield* sessionStatus(String(session.slug))).toBe("abandoned")
        expect(yield* active(ada.token)).toBeNull()
      })
    ))
})

// A soft delete has to end a session that would otherwise keep asking for words that are gone.
describe("deleting content under an active session", () => {
  const deleteWord = (token: string, wordSlug: string) =>
    call((c) => c.library.deleteWord({ params: { wordSlug: wordSlug as never } }), token)

  const deleteDeck = (token: string, deckSlug: string) =>
    call((c) => c.library.deleteDeck({ params: { deckSlug: deckSlug as never } }), token)

  test("deleting an asked word abandons the session; deleting an unasked one leaves it active", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(8))
        const session = yield* start(token, deck.deckSlug)
        const asked = new Set(slugsOf(session.questions))
        const spare = deck.words.find((word) => !asked.has(word.slug))

        yield* deleteWord(token, spare!.slug)

        expect(yield* sessionStatus(String(session.slug))).toBe("active")

        yield* deleteWord(token, String(session.questions[0]!.wordSlug))

        expect(yield* sessionStatus(String(session.slug))).toBe("abandoned")
        expect(yield* active(token)).toBeNull()
      })
    ))

  test("deleting the deck abandons the session scoped to it", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, words(8))
        const session = yield* start(token, deck.deckSlug)

        yield* deleteDeck(token, deck.deckSlug)

        expect(yield* sessionStatus(String(session.slug))).toBe("abandoned")
        expect(yield* active(token)).toBeNull()
      })
    ))
})
