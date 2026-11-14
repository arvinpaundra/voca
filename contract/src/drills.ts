import type { Drill } from "./primitives.ts"

/** The field labels for a deck's words, which follow its term language. */
export interface WordLabels {
  readonly term: string
  readonly reading: string
}

const profiles = new Map<string, WordLabels>([
  ["ja", { term: "Word", reading: "Hiragana" }],
  ["zh", { term: "Hanzi", reading: "Pinyin" }],
  ["yue", { term: "Hanzi", reading: "Jyutping" }]
])

const fallback: WordLabels = { term: "Word", reading: "Reading" }

const primarySubtag = (termLang: string): string => termLang.split("-")[0]!.toLowerCase()

export const wordLabels = (termLang: string): WordLabels => profiles.get(primarySubtag(termLang)) ?? fallback

export type Field = "term" | "reading" | "meaning"

/** What each drill shows (prompt) and what the Learner picks from 4 options (answer). */
export const DRILLS: Readonly<Record<Drill, { readonly prompt: Field; readonly answer: Field }>> = {
  term_meaning: { prompt: "term", answer: "meaning" },
  meaning_term: { prompt: "meaning", answer: "term" },
  term_reading: { prompt: "term", answer: "reading" },
  reading_term: { prompt: "reading", answer: "term" }
}

const fieldLabel = (termLang: string, field: Field): string =>
  field === "meaning" ? "Meaning" : wordLabels(termLang)[field]

/** The direction label shown above a question and in the drill picker, e.g. "Word → Hiragana" for ja. */
export const drillLabel = (termLang: string, drill: Drill): string =>
  `${fieldLabel(termLang, DRILLS[drill].prompt)} → ${fieldLabel(termLang, DRILLS[drill].answer)}`
