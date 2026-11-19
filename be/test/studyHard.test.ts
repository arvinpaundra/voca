import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect } from "effect"
import type { Drill, Mode, Question } from "@voca/contract"
import { at, call, makeIdentityRuntime } from "./identity.ts"
import { seedCard, seedDeck, signedIn, type NewWord } from "./seed.ts"
import { resetDb } from "./setup.ts"

// Hard mode over HTTP: the options are the most similar words of the deck instead of random ones.
// Each deck is seeded as a cluster of look-alike words first (the session picks the first new words
// it finds, so every prompt is a cluster word) followed by words that resemble nothing.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T00:00:00Z"))))

const DUE = "2026-11-13T04:00:00Z"

const unrelated: ReadonlyArray<NewWord> = [
  { term: "猫", meaning: "cat", reading: "ひら" },
  { term: "犬", meaning: "dog", reading: "ふゆ" },
  { term: "鳥", meaning: "bird", reading: "ほし" }
]

/** Seven words with the same reading and nothing else in common. */
const homophones: ReadonlyArray<NewWord> = ["橋", "箸", "端", "嘴", "梯", "觜", "鉢"].map((term, i) => ({
  term,
  meaning: `homophone ${i}`,
  reading: "はし"
}))

/** Seven terms that share their first character and readings that share their first two. */
const lookAlikes: ReadonlyArray<NewWord> = [
  ["生活", "せいかつ"],
  ["生命", "せいめい"],
  ["生産", "せいさん"],
  ["生物", "せいぶつ"],
  ["生徒", "せいと"],
  ["生涯", "せいがい"],
  ["生年", "せいねん"]
].map(([term, reading], i) => ({ term: term!, meaning: `look-alike ${i}`, reading: reading! }))

const startDeck = (token: string, deckSlug: string, mode: Mode, drills: ReadonlyArray<Drill> = ["term_meaning"]) =>
  call(
    (c) =>
      c.study.start({
        payload: {
          scope: { kind: "deck", deckSlug: deckSlug as never },
          drills: drills as never,
          size: 7,
          mode
        }
      }),
    token
  )

const startHard = (token: string, mode: Mode) =>
  call(
    (c) =>
      c.study.start({
        payload: { scope: { kind: "hard" }, drills: ["term_meaning"] as never, size: 7, mode }
      }),
    token
  )

const answerWrong = (token: string, sessionSlug: string, question: Question) => {
  const wrong = question.options.find((option) => option.wordSlug !== question.wordSlug)!

  return call(
    (c) =>
      c.study.answer({
        params: { sessionSlug: sessionSlug as never },
        payload: { position: question.position, chosenWordSlug: wrong.wordSlug, latencyMs: 2000 }
      }),
    token
  )
}

/** The slugs of the options that are not the prompt itself. */
const distractorsOf = (question: Question) =>
  question.options.map((option) => String(option.wordSlug)).filter((slug) => slug !== String(question.wordSlug))

describe("POST /sessions in hard mode", () => {
  test("the session is stored and returned as hard, and resumes as hard", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, [...lookAlikes, ...unrelated])

        const session = yield* startDeck(token, deck.deckSlug, "hard")
        const resumed = yield* call((c) => c.study.active(), token)

        expect(session.mode).toBe("hard")
        expect(resumed?.mode).toBe("hard")
      })
    ))

  test("a homophone's options are the other homophones, never the unrelated words", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, [...homophones, ...unrelated])
        const cluster = new Set(deck.words.slice(0, 7).map((word) => word.slug))

        const session = yield* startDeck(token, deck.deckSlug, "hard")

        expect(session.questions).toHaveLength(7)

        for (const question of session.questions) {
          const distractors = distractorsOf(question)

          expect(distractors).toHaveLength(3)
          expect(distractors.every((slug) => cluster.has(slug))).toBe(true)
        }
      })
    ))

  test("a look-alike term's options are the terms that share its characters", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, [...lookAlikes, ...unrelated])
        const cluster = new Set(deck.words.slice(0, 7).map((word) => word.slug))

        const session = yield* startDeck(token, deck.deckSlug, "hard")

        for (const question of session.questions) {
          expect(distractorsOf(question).every((slug) => cluster.has(slug))).toBe(true)
        }
      })
    ))

  test("tone marks do not hide a similar pinyin reading", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")

        const pinyin: ReadonlyArray<NewWord> = [
          ["十", "shí"],
          ["时", "shì"],
          ["事", "shì"],
          ["市", "shì"],
          ["石", "shí"],
          ["式", "shì"],
          ["实", "shí"]
        ].map(([term, reading], i) => ({ term: term!, meaning: `pinyin ${i}`, reading: reading! }))

        const far: ReadonlyArray<NewWord> = [
          { term: "马", meaning: "horse", reading: "mǎ" },
          { term: "龙", meaning: "dragon", reading: "lóng" },
          { term: "好", meaning: "good", reading: "hǎo" }
        ]

        const deck = yield* seedDeck(id, [...pinyin, ...far], { termLang: "zh" })
        const cluster = new Set(deck.words.slice(0, 7).map((word) => word.slug))

        const session = yield* startDeck(token, deck.deckSlug, "hard")

        for (const question of session.questions) {
          expect(distractorsOf(question).every((slug) => cluster.has(slug))).toBe(true)
        }
      })
    ))

  test("a reading question compares readings only, whatever the terms look like", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")

        const readings: ReadonlyArray<NewWord> = [
          ["橋", "はし"],
          ["星", "ほし"],
          ["恥", "はじ"],
          ["瀬", "はせ"],
          ["増", "まし"],
          ["師", "ひし"],
          ["士", "はみ"]
        ].map(([term, reading], i) => ({ term: term!, meaning: `reading ${i}`, reading: reading! }))

        // Their terms look like the first prompt's term, their readings look like nothing.
        const termTwins: ReadonlyArray<NewWord> = [
          { term: "橋本", meaning: "twin 0", reading: "ぬめ" },
          { term: "橋口", meaning: "twin 1", reading: "ゆず" },
          { term: "橋田", meaning: "twin 2", reading: "ふれ" }
        ]

        const deck = yield* seedDeck(id, [...readings, ...termTwins])
        const cluster = new Set(deck.words.slice(0, 7).map((word) => word.slug))

        const session = yield* startDeck(token, deck.deckSlug, "hard", ["term_reading"])

        expect(session.questions).toHaveLength(7)

        for (const question of session.questions) {
          expect(distractorsOf(question).every((slug) => cluster.has(slug))).toBe(true)
        }
      })
    ))

  test("with fewer than 3 similar words, the similar ones are all kept and the rest is filled", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")

        const pair: ReadonlyArray<NewWord> = [
          { term: "生活", meaning: "life", reading: "せいかつ" },
          { term: "生命", meaning: "lifespan", reading: "せいめい" }
        ]

        const others: ReadonlyArray<NewWord> = [
          ["猫", "ひら"],
          ["犬", "ふゆ"],
          ["鳥", "ほし"],
          ["魚", "むれ"],
          ["虫", "ゆき"],
          ["貝", "ろく"]
        ].map(([term, reading], i) => ({ term: term!, meaning: `other ${i}`, reading: reading! }))

        const deck = yield* seedDeck(id, [...pair, ...others])
        const [life, lifespan] = deck.words

        const session = yield* startDeck(token, deck.deckSlug, "hard")

        const ofLife = session.questions.find((question) => question.wordSlug === life!.slug)!
        const ofLifespan = session.questions.find((question) => question.wordSlug === lifespan!.slug)!

        expect(distractorsOf(ofLife)).toHaveLength(3)
        expect(distractorsOf(ofLife)).toContain(lifespan!.slug)
        expect(distractorsOf(ofLifespan)).toContain(life!.slug)
      })
    ))

  test("a retry after a wrong answer is still made of similar words", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, [...homophones, ...unrelated])
        const cluster = new Set(deck.words.slice(0, 7).map((word) => word.slug))

        const session = yield* startDeck(token, deck.deckSlug, "hard")
        const result = yield* answerWrong(token, String(session.slug), session.questions[0]!)

        expect(result.correct).toBe(false)
        expect(result.retry).not.toBeNull()
        expect(distractorsOf(result.retry!)).toHaveLength(3)
        expect(distractorsOf(result.retry!).every((slug) => cluster.has(slug))).toBe(true)
      })
    ))

  test("a session over the Hard Words list honors the mode too", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, [...homophones, ...unrelated])
        const clusterWords = deck.words.slice(0, 7)
        const cluster = new Set(clusterWords.map((word) => word.slug))

        for (const word of clusterWords) {
          yield* seedCard(id, word.id, "term_meaning", { due: DUE, hard: true })
        }

        const session = yield* startHard(token, "hard")

        expect(session.mode).toBe("hard")
        expect(session.questions.length).toBeGreaterThan(0)

        for (const question of session.questions) {
          expect(distractorsOf(question).every((slug) => cluster.has(slug))).toBe(true)
        }
      })
    ))

  test("easy mode is still stored as easy", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, [...lookAlikes, ...unrelated])

        const session = yield* startDeck(token, deck.deckSlug, "easy")

        expect(session.mode).toBe("easy")
      })
    ))
})
