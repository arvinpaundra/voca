/** The field labels for a deck's words, which follow its term language. Not implemented yet: task FW. */
export interface WordLabels {
  readonly term: string
  readonly reading: string
}

export const wordLabels = (_termLang: string): WordLabels => {
  return { term: "not implemented", reading: "not implemented" }
}
