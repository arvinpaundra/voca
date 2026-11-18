/** A language a deck can be in: the tag that is stored, and what the picker shows. */
export type LanguageOption = { readonly value: string; readonly label: string };

/** The languages offered in the deck form, in the order they are shown. */
export const languageOptions = (): readonly LanguageOption[] => {
  throw new Error("not implemented: FORMS");
};

/** The value the picker shows for a tag: an offered language, or the "other" escape for anything else. */
export const pickerValue = (tag: string): string => {
  throw new Error("not implemented: FORMS");
};
