/**
 * The key two words are compared by: NFKC, case-folded, with surrounding whitespace trimmed. So `ｶﾀｶﾅ` and `カタカナ`
 * collide, and so do `Apple` and `apple`. Hiragana and katakana stay apart on purpose.
 */
export const normalizeKey = (text: string): string => {
  return text.normalize("NFKC").toLowerCase().trim()
}

/** Word text as stored: canonical composition, so `e` + combining acute and `é` are the same text. */
export const toStoredText = (text: string): string => {
  return text.normalize("NFC")
}
