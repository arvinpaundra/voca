export const WORD_FONTS = ["system", "sans", "serif", "rounded", "handwriting"] as const;

export type WordFont = (typeof WORD_FONTS)[number];

export const WORD_FONT_KEY = "voca.wordFont";

export const WORD_FONT_CLASS = "word-font";

const DEFAULT_FONT: WordFont = "system";

const isWordFont = (value: string | null): value is WordFont => WORD_FONTS.some((font) => font === value);

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
  } catch {}

  apply(font);
};

export const applyWordFont = (): void => {
  apply(wordFont());
};

export type Run = { readonly text: string; readonly cjk: boolean };

export const cjkRuns = (text: string): readonly Run[] => [{ text: `not implemented: WF ${text}`, cjk: false }];
