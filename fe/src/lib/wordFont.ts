export const WORD_FONTS = ["system", "sans", "serif", "rounded", "handwriting"] as const;

export type WordFont = (typeof WORD_FONTS)[number];

export const WORD_FONT_KEY = "voca.wordFont";

// The class every piece of word content carries; the stylesheet gives it the chosen font.
export const WORD_FONT_CLASS = "word-font";

const DEFAULT_FONT: WordFont = "system";

const isWordFont = (value: string | null): value is WordFont => WORD_FONTS.some((font) => font === value);

// Blocked storage reads as no choice, so the default font applies.
export const wordFont = (): WordFont => {
  try {
    const stored = window.localStorage.getItem(WORD_FONT_KEY);

    return isWordFont(stored) ? stored : DEFAULT_FONT;
  } catch {
    return DEFAULT_FONT;
  }
};

const apply = (font: WordFont): void => {
  document.documentElement.dataset.wordFont = font;
};

export const setWordFont = (font: WordFont): void => {
  try {
    window.localStorage.setItem(WORD_FONT_KEY, font);
  } catch {
    // Blocked storage: the choice is not kept, but it still applies to this page.
  }

  apply(font);
};

// Called before the first render, so a reload shows the stored choice without a flash of the default.
export const applyWordFont = (): void => {
  apply(wordFont());
};
