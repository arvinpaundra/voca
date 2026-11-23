export const NOW = "2026-11-18T12:00:00.000Z"
export const TIMEZONE = "Asia/Jakarta"

const T = "2026-11-01T00:00:00.000Z"
const deckSlug = (n: number) => `DECK00000${n}`
const wordSlug = (n: number) => `WRD00000000${n}`

const days = (count: number, from: string) =>
  Array.from({ length: count }, (_, i) => {
    const day = new Date(`${from}T00:00:00.000Z`)
    day.setUTCDate(day.getUTCDate() + i)
    return day.toISOString().slice(0, 10)
  })

const deck = (n: number, title: string, termLang: string, dueCount: number, wordCount: number, isPublic: boolean) => ({
  slug: deckSlug(n),
  title,
  description: n === 1 ? "Common verbs for the JLPT N5, with readings and one example each." : "",
  termLang,
  meaningLang: "en",
  visibility: isPublic ? "public" : "private",
  publishedAt: isPublic ? T : null,
  forkedFrom: n === 1 ? { slug: deckSlug(9), title: "JLPT Core", deleted: false } : null,
  forkCount: n === 1 ? 14 : 0,
  createdAt: T,
  updatedAt: T,
  wordCount,
  dueCount,
})

const decks = [
  deck(1, "Japanese N5 verbs", "ja", 20, 248, true),
  deck(2, "Kanji radicals", "ja", 9, 214, false),
  deck(3, "Arabic everyday nouns", "ar", 3, 160, false),
  deck(4, "Mandarin HSK 1", "zh", 0, 150, true),
  deck(5, "Russian food & cooking", "ru", 0, 96, false),
  deck(6, "Korean honorifics", "ko", 0, 0, false),
]

const card = (due: string, stabilityDays: number) => ({ drill: "term_meaning", due, stabilityDays, isHard: false })

const word = (n: number, term: string, reading: string, meaning: string, example: string, cards: unknown[]) => ({
  slug: wordSlug(n),
  term,
  reading,
  meaning,
  example,
  notes: null,
  createdAt: T,
  cards,
})

const words = [
  word(1, "食べる", "たべる", "to eat", "毎朝パンを食べる。 I eat bread every morning.", [card("2026-11-18T00:00:00.000Z", 3)]),
  word(2, "飲む", "のむ", "to drink", "水を飲む。 I drink water.", [card("2026-11-25T00:00:00.000Z", 8)]),
  word(3, "行く", "いく", "to go", "学校へ行く。 I go to school.", [card("2027-01-20T00:00:00.000Z", 40)]),
  word(4, "見る", "みる", "to see, to watch", "映画を見る。 I watch a movie.", []),
]

const reviews30 = [12, 18, 0, 22, 30, 14, 9, 26, 31, 20, 0, 16, 24, 28, 19, 12, 35, 22, 18, 25, 30, 14, 0, 21, 27, 33, 18, 24, 29, 18]

const learnerStats = {
  maturity: { new: 72, learning: 204, mature: 186 },
  dueToday: 32,
  overdue: 3,
  forecast: days(7, "2026-11-18").map((date, i) => ({ date, count: [32, 18, 24, 9, 12, 30, 15][i]! })),
  trueRetention: 0.86,
  calibration: { predicted: 0.88, actual: 0.86 },
  reviewsPerDay: days(30, "2026-10-20").map((date, i) => ({ date, count: reviews30[i]! })),
  streak: { days: 12, studiedToday: true },
}

const deckStats = {
  maturity: { new: 48, learning: 96, mature: 104 },
  dueToday: 20,
  overdue: 0,
  forecast: days(7, "2026-11-18").map((date, i) => ({ date, count: [20, 9, 14, 3, 6, 18, 7][i]! })),
  trueRetention: 0.88,
  calibration: { predicted: 0.9, actual: 0.88 },
  reviewsPerDay: days(30, "2026-10-20").map((date, i) => ({ date, count: reviews30[i]! })),
}

const heatLevels = [3, 2, 0, 4, 3, 1, 2, 4, 3, 0, 2, 3, 4, 1, 2, 3, 4, 3]
const perLevel = [0, 5, 12, 22, 35]

const learner = {
  slug: "AKTN0001",
  email: "arvin@example.com",
  name: "Arvin Paundra",
  avatarUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  settings: {
    timezone: TIMEZONE,
    dayStartHour: 4,
    desiredRetention: 0.9,
    newPerDay: 20,
    defaultSessionSize: 20,
    defaultMode: "easy",
  },
}

const owner = (name: string) => ({ name, avatarUrl: null })

const publicDeck = (n: number, title: string, termLang: string, wordCount: number, forkCount: number, name: string) => ({
  slug: deckSlug(n),
  title,
  description: "The 800 most common words across JLPT N5–N4 lists, each with a reading and a short example.",
  termLang,
  meaningLang: "en",
  publishedAt: T,
  forkCount,
  wordCount,
  owner: owner(name),
})

const publicDecks = [
  publicDeck(7, "JLPT Core 800", "ja", 800, 1200, "Mika T."),
  publicDeck(8, "HSK 2 complete", "zh", 300, 640, "Wei L."),
  publicDeck(9, "Spanish travel phrases", "es", 180, 412, "Lucía R."),
  publicDeck(5, "Quranic Arabic roots", "ar", 250, 298, "Omar K."),
]

const previewWords = [
  ["水", "water"],
  ["学校", "school"],
  ["友達", "friend"],
  ["新しい", "new"],
].map(([term, meaning], i) => ({
  slug: wordSlug(i + 5),
  term,
  reading: null,
  meaning,
  example: null,
  notes: null,
  createdAt: T,
}))

const question = {
  position: 9,
  attempt: 1,
  wordSlug: wordSlug(1),
  drill: "term_meaning",
  drillLabel: "Term → Meaning",
  prompt: { text: "食べる", ruby: "たべる" },
  options: [
    { wordSlug: wordSlug(2), text: "to drink" },
    { wordSlug: wordSlug(1), text: "to eat" },
    { wordSlug: wordSlug(3), text: "to see" },
    { wordSlug: wordSlug(4), text: "to sleep" },
  ],
}

const studySession = (state: string) => ({
  slug: "SESS0000000001",
  drills: ["term_meaning"],
  termLang: "ja",
  mode: "easy",
  size: 20,
  status: state === "complete" ? "completed" : "active",
  cleared: state === "complete" ? 20 : 8,
  questions: state === "complete" ? [] : [question],
})

const drillStats = (drill: string, label: string, maturity: string, overrides: Record<string, unknown>) => ({
  drill,
  label,
  maturity,
  recallNow: 0.82,
  stabilityDays: 12.4,
  difficulty: 5.6,
  reps: 14,
  lapses: 4,
  leech: true,
  isHard: false,
  accuracy: { overall: 0.78, last10: 0.9, easy: 0.84, hard: 0.61 },
  streak: 5,
  medianLatencyMs: 2100,
  attemptsToCorrect: 1.3,
  nextDue: "2026-11-21T00:00:00.000Z",
  intervalDays: 12,
  firstSeen: "2026-10-03T09:00:00.000Z",
  lastReviewed: "2026-11-18T14:04:00.000Z",
  confusedWith: [
    { wordSlug: wordSlug(2), term: "飲む", count: 6 },
    { wordSlug: wordSlug(4), term: "見る", count: 2 },
    { wordSlug: wordSlug(9), term: "寝る", count: 1 },
  ],
  history: [
    { at: "2026-11-18T14:04:00.000Z", correct: true, rating: 3, latencyMs: 1800, predictedRecall: 0.86, intervalDays: 12 },
    { at: "2026-11-14T01:12:00.000Z", correct: false, rating: 1, latencyMs: 4200, predictedRecall: 0.71, intervalDays: 1 },
    { at: "2026-11-09T12:40:00.000Z", correct: true, rating: 2, latencyMs: 6000, predictedRecall: 0.8, intervalDays: 5 },
  ],
  ...overrides,
})

const wordStats = {
  word: (({ cards: _c, ...w }) => w)(words[0]!),
  drills: [
    drillStats("term_meaning", "Term → Meaning", "learning", {}),
    drillStats("reading_term", "Reading → Term", "learning", { leech: false, lapses: 1, recallNow: 0.93 }),
  ],
}

const hardDeck = (n: number) => {
  const d = decks.find((x) => x.slug === deckSlug(n))!
  return { slug: d.slug, title: d.title, termLang: d.termLang, meaningLang: d.meaningLang }
}

const hardCard = (drill: string, due: string) => ({ drill, due, stabilityDays: 4, isHard: true })

const hardWords = [
  { ...word(1, "食べる", "たべる", "to eat", "", [hardCard("term_meaning", "2026-11-18T00:00:00.000Z")]), example: null, deck: hardDeck(1) },
  { ...word(6, "学习", "xuéxí", "to study", "", [hardCard("reading_term", "2026-11-25T00:00:00.000Z")]), example: null, deck: hardDeck(4) },
  { ...word(7, "مَدْرَسَة", "", "school", "", [hardCard("meaning_term", "2026-11-18T00:00:00.000Z")]), reading: null, example: null, deck: hardDeck(3) },
]

const importFile = (name: string, status: string, deck: string | null, imported: number, skipped: number) => ({
  name,
  status,
  deck: deck === null ? null : { slug: deckSlug(1), title: deck },
  imported,
  skippedDuplicates: skipped,
  errors: [],
  totalErrors: 0,
})

const importBatches = (state: string) => {
  const failed = {
    ...importFile("N5 adjectives.csv", "failed", null, 0, 0),
    errors: [
      { row: 14, column: "meaning", message: "meaning is required" },
      { row: 31, column: "term", message: "term is longer than 200 characters" },
      { row: 52, column: null, message: "unknown column “meening”" },
    ],
    totalErrors: 104,
  }
  const running = {
    slug: "BATCH00000000002",
    termLang: "ja",
    meaningLang: "en",
    createdAt: "2026-11-18T11:58:00.000Z",
    files: [
      importFile("N5 verbs.csv", "done", "N5 verbs", 248, 3),
      importFile("N5 nouns.csv", "done", "N5 nouns", 412, 0),
      failed,
      importFile("Particles.csv", "running", null, 0, 0),
      importFile("Counters.csv", "pending", null, 0, 0),
    ],
  }
  const finished = {
    slug: "BATCH00000000001",
    termLang: "zh-Hans",
    meaningLang: "en",
    createdAt: "2026-11-18T11:50:00.000Z",
    files: [importFile("HSK 1.csv", "done", "HSK 1", 150, 0), importFile("HSK 2.csv", "done", "HSK 2", 151, 2)],
  }
  if (state === "imports") return [running, finished]
  if (state === "imports-done") return [{ ...running, files: running.files.slice(0, 3) }, finished]
  return []
}

export const NO_CONTENT = Symbol("no content")

type Handler = (url: URL, state: string, method: string) => unknown

export const routes: ReadonlyArray<readonly [RegExp, Handler]> = [
  [/^\/api\/auth\/refresh$/, () => ({ accessToken: "mock.access.token", refreshToken: "A".repeat(43), expiresIn: 3600 })],
  [/^\/api\/me$/, () => learner],
  [/^\/api\/imports$/, (_url, state) => importBatches(state)],
  [/^\/api\/imports\/events\/ticket$/, () => ({ ticket: "mock-ticket" })],
  [/^\/api\/imports\/events$/, () => NO_CONTENT],
  [/^\/api\/me\/stats$/, () => learnerStats],
  [/^\/api\/me\/activity$/, () => ({
    month: "2026-11",
    days: heatLevels
      .map((level, i) => ({ date: `2026-11-${String(i + 1).padStart(2, "0")}`, reviews: perLevel[level]! }))
      .filter((day) => day.reviews > 0),
  })],
  [/^\/api\/notifications$/, () => ({
    decks: [
      { deckSlug: deckSlug(1), title: "Japanese N5 verbs", due: 20, overdue: 0, byDrill: [
        { drill: "term_meaning", label: "Term → Meaning", due: 14 },
        { drill: "term_reading", label: "Reading", due: 6 },
      ] },
      { deckSlug: deckSlug(2), title: "Kanji radicals", due: 9, overdue: 3, byDrill: [] },
      { deckSlug: deckSlug(3), title: "Arabic everyday nouns", due: 3, overdue: 0, byDrill: [
        { drill: "meaning_term", label: "Meaning → Term", due: 3 },
      ] },
    ],
    hardDue: 5,
    newAvailable: 10,
    estimatedMinutes: 8,
  })],
  [/^\/api\/decks$/, () => ({ items: decks, nextCursor: null, total: decks.length, termLangs: [...new Set(decks.map((d) => d.termLang))].sort() })],
  [/^\/api\/decks\/[0-9A-Z]{10}$/, (url) => {
    const slug = url.pathname.split("/").pop()
    return decks.find((d) => d.slug === slug) ?? decks[0]!
  }],
  [/^\/api\/decks\/[0-9A-Z]{10}\/words$/, () => ({ items: words, nextCursor: "next" })],
  [/^\/api\/decks\/[0-9A-Z]{10}\/stats$/, () => deckStats],
  [/^\/api\/decks\/[0-9A-Z]{10}\/drills$/, () => [
    { drill: "term_meaning", label: "Term → Meaning", due: 14, new: 10 },
    { drill: "reading_term", label: "Reading → Term", due: 6, new: 10 },
    { drill: "meaning_term", label: "Meaning → Term", due: 0, new: 10 },
  ]],
  [/^\/api\/sessions\/active$/, (_url, state) => studySession(state)],
  [/^\/api\/sessions\/[0-9A-Z]{14}\/answers$/, (_url, state) =>
    state === "finish"
      ? { correct: true, correctWordSlug: wordSlug(1), nextDue: "2026-11-19T00:00:00.000Z", retry: null, completed: true, leech: true }
      : {
          correct: false,
          correctWordSlug: wordSlug(1),
          nextDue: "2026-11-19T00:00:00.000Z",
          retry: { ...question, position: 12, attempt: 2 },
          completed: false,
          leech: false,
        }],
  [/^\/api\/words\/[0-9A-Z]{12}\/drills\/[a-z_]+\/hard$/, () => NO_CONTENT],
  [/^\/api\/words\/[0-9A-Z]{12}\/stats$/, () => wordStats],
  [/^\/api\/hard-words$/, () => ({
    items: hardWords,
    nextCursor: null,
    summary: {
      total: hardWords.length,
      dueToday: hardWords.length,
      drills: [...new Set(hardWords.flatMap((w) => w.cards.map((c) => c.drill)))].map((drill) => ({
        drill,
        count: hardWords.filter((w) => w.cards.some((c) => c.drill === drill)).length,
        termLang: hardWords.find((w) => w.cards.some((c) => c.drill === drill))!.deck.termLang
      }))
    }
  })],
  [/^\/api\/community\/decks$/, () => ({ items: publicDecks, nextCursor: null })],
  [/^\/api\/community\/decks\/[0-9A-Z]{10}$/, () => ({ ...publicDecks[0]!, preview: previewWords })],
]
