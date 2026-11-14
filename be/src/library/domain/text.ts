/**
 * The key two words are compared by: NFKC, case-folded, with surrounding whitespace trimmed. So `ｶﾀｶﾅ` and `カタカナ`
 * collide, and so do `Apple` and `apple`. Text itself is stored as NFC. Not implemented yet: task LW.
 */
export const normalizeKey = (_text: string): string => {
  return "not implemented"
}
