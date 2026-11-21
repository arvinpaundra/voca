export const WORD_FONTS = ["system", "sans", "serif", "rounded", "handwriting"] as const;

export type WordFont = (typeof WORD_FONTS)[number];

export const WORD_FONT_KEY = "voca.wordFont";

// The class every piece of word content carries; the stylesheet gives it the chosen font.
export const WORD_FONT_CLASS = "word-font";

export const wordFont = (): WordFont => {
  throw new Error("not implemented: WF");
};

export const setWordFont = (_font: WordFont): void => {
  throw new Error("not implemented: WF");
};

export const applyWordFont = (): void => {
  throw new Error("not implemented: WF");
};
