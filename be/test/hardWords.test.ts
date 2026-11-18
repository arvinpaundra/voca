import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import type { Drill } from "@voca/contract"
import { at, call, makeIdentityRuntime } from "./identity.ts"
import { seedCard, seedDeck, signedIn, wordList } from "./seed.ts"
import { resetDb } from "./setup.ts"

// Hard Words: list hard cards across decks (with each word's deck), mark and unmark a card,
// and study a session scoped to hard words. The clock is 2026-11-14T00:00Z; today's study day
// ends 2026-11-14T04:00Z (UTC, dayStartHour 4).

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T00:00:00Z"))))

const DUE = "2026-11-13T12:00:00Z"
const LATER = "2026-11-25T00:00:00Z"

const hardWords = (token: string, drill?: Drill) =>
  call((c) => c.study.hardWords({ query: drill === undefined ? {} : { drill } }), token)

const mark = (token: string, wordSlug: string, drill: Drill) =>
  call((c) => c.study.markHard({ params: { wordSlug: wordSlug as never, drill } }), token)

const unmark = (token: string, wordSlug: string, drill: Drill) =>
  call((c) => c.study.unmarkHard({ params: { wordSlug: wordSlug as never, drill } }), token)

const startHard = (token: string, drills: ReadonlyArray<Drill>) =>
  call(
    (c) => c.study.start({ payload: { scope: { kind: "hard" }, drills: drills as never, size: 7, mode: "easy" } }),
    token
  )

/** Two decks of Ada's: one hard card in each (different drills), plus cards that are not hard. */
const seedHard = Effect.gen(function* () {
  const ada = yield* signedIn("ADA00001")
  const verbs = yield* seedDeck(ada.id, wordList(5, "動"), { title: "Japanese N5 verbs" })
  const hanzi = yield* seedDeck(ada.id, wordList(5, "汉"), { title: "Mandarin HSK 1", termLang: "zh" })

  yield* seedCard(ada.id, verbs.words[0]!.id, "term_meaning", { due: DUE, hard: true })
  yield* seedCard(ada.id, verbs.words[1]!.id, "term_meaning", { due: DUE })
  yield* seedCard(ada.id, hanzi.words[0]!.id, "reading_term", { due: LATER, hard: true })
  yield* seedCard(ada.id, hanzi.words[1]!.id, "term_meaning", { due: DUE })

  return { ada, verbs, hanzi }
})

describe("GET /hard-words", () => {
  test("lists the words with a hard card across decks, each with its deck", async () => {
    await rt.runPromise(
      Effect.gen(function* () {
        const { ada, verbs, hanzi } = yield* seedHard

        const page = yield* hardWords(ada.token)
        const bySlug = new Map(page.items.map((item) => [String(item.slug), item]))

        expect([...bySlug.keys()].sort()).toEqual([verbs.words[0]!.slug, hanzi.words[0]!.slug].sort())
        expect(page.nextCursor).toBeNull()

        const verb = bySlug.get(verbs.words[0]!.slug)!
        expect(verb.term).toBe(verbs.words[0]!.term)
        expect(verb.deck).toEqual({ slug: verbs.deckSlug as never, title: "Japanese N5 verbs", termLang: "ja", meaningLang: "en" })
        expect(verb.cards.map((card) => ({ drill: card.drill, isHard: card.isHard }))).toEqual([{ drill: "term_meaning", isHard: true }])

        expect(bySlug.get(hanzi.words[0]!.slug)!.deck).toEqual({
          slug: hanzi.deckSlug as never,
          title: "Mandarin HSK 1",
          termLang: "zh",
          meaningLang: "en"
        })
      })
    )
  })

  test("filters by drill, and never shows another learner's words", async () => {
    await rt.runPromise(
      Effect.gen(function* () {
        const { ada, hanzi } = yield* seedHard
        const bob = yield* signedIn("BB000001")

        const reading = yield* hardWords(ada.token, "reading_term")
        expect(reading.items.map((item) => String(item.slug))).toEqual([hanzi.words[0]!.slug])

        const theirs = yield* hardWords(bob.token)
        expect(theirs.items).toEqual([])
      })
    )
  })
})

describe("mark and unmark", () => {
  test("marking a studied card adds the word; unmarking removes it", async () => {
    await rt.runPromise(
      Effect.gen(function* () {
        const { ada, verbs } = yield* seedHard
        const word = verbs.words[1]!

        yield* mark(ada.token, word.slug, "term_meaning")
        const marked = yield* hardWords(ada.token, "term_meaning")
        expect(marked.items.map((item) => String(item.slug)).sort()).toEqual([verbs.words[0]!.slug, word.slug].sort())

        yield* unmark(ada.token, word.slug, "term_meaning")
        yield* unmark(ada.token, verbs.words[0]!.slug, "term_meaning")
        const unmarked = yield* hardWords(ada.token, "term_meaning")
        expect(unmarked.items).toEqual([])
      })
    )
  })

  test("a drill the word was never studied in, or another learner's word, is not found", async () => {
    await rt.runPromise(
      Effect.gen(function* () {
        const { ada, verbs } = yield* seedHard
        const bob = yield* signedIn("BB000001")

        const unstudied = yield* mark(ada.token, verbs.words[2]!.slug, "term_meaning").pipe(Effect.flip)
        expect(unstudied._tag).toBe("NotFound")

        const theirs = yield* mark(bob.token, verbs.words[1]!.slug, "term_meaning").pipe(Effect.flip)
        expect(theirs._tag).toBe("NotFound")
      })
    )
  })
})

describe("POST /sessions scoped to hard words", () => {
  test("asks only the hard cards of the chosen drills, each with options from its own deck", async () => {
    await rt.runPromise(
      Effect.gen(function* () {
        const { ada, verbs, hanzi } = yield* seedHard

        const session = yield* startHard(ada.token, ["term_meaning", "reading_term"])

        expect(session.status).toBe("active")
        expect(session.questions.map((q) => String(q.wordSlug)).sort()).toEqual([verbs.words[0]!.slug, hanzi.words[0]!.slug].sort())

        for (const question of session.questions) {
          const deck = String(question.wordSlug) === verbs.words[0]!.slug ? verbs : hanzi
          const pool = new Set(deck.words.map((w) => w.slug))
          expect(question.options.every((option) => pool.has(String(option.wordSlug)))).toBe(true)
        }

        expect(session.questions.find((q) => String(q.wordSlug) === hanzi.words[0]!.slug)!.drill).toBe("reading_term")
      })
    )
  })

  test("a drill without hard cards is left out of the session", async () => {
    await rt.runPromise(
      Effect.gen(function* () {
        const { ada, verbs } = yield* seedHard

        const session = yield* startHard(ada.token, ["term_meaning"])

        expect(session.questions.map((q) => String(q.wordSlug))).toEqual([verbs.words[0]!.slug])
      })
    )
  })
})
