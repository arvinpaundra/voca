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
