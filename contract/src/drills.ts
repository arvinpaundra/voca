import type { Drill } from "./primitives.ts"

/** The field labels for a deck's words, which follow its term language. */
export interface WordLabels {
  readonly term: string
  readonly reading: string
}

/**
 * The language tag a reading is written in. Hiragana is Japanese, but pinyin and jyutping are Latin
 * transcriptions: tagging them keeps a screen reader from reading `xuéxí` as Chinese.
 * `null` means the reading has no script of its own, so it is tagged with the term's language.
 */
interface Profile extends WordLabels {
  readonly readingLang: string | null
}

const profiles = new Map<string, Profile>([
  ["ja", { term: "Word", reading: "Hiragana", readingLang: null }],
  ["zh", { term: "Hanzi", reading: "Pinyin", readingLang: "zh-Latn-pinyin" }],
  ["yue", { term: "Hanzi", reading: "Jyutping", readingLang: "yue-Latn-jyutping" }]
])

const fallback: Profile = { term: "Word", reading: "Reading", readingLang: null }

const primarySubtag = (termLang: string): string => termLang.split("-")[0]!.toLowerCase()

const profileOf = (termLang: string): Profile => profiles.get(primarySubtag(termLang)) ?? fallback

export const wordLabels = (termLang: string): WordLabels => {
  const { term, reading } = profileOf(termLang)

  return { term, reading }
}

/** The `lang` for a word's reading in a deck whose terms are in `termLang`. */
export const readingLang = (termLang: string): string => profileOf(termLang).readingLang ?? termLang

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
