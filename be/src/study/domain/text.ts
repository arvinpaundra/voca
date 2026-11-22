/**
 * The form a search text is matched in: NFKC, case-folded, with surrounding whitespace trimmed. It is the same form the
 * stored word keys are in, so a search matches a word the way the word list does.
 */
export const searchKey = (text: string): string => {
  return text.normalize("NFKC").toLowerCase().trim()
}
