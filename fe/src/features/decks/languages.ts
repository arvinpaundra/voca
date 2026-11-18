/** A language a deck can be in: the tag that is stored, and what the picker shows. */
export type LanguageOption = { readonly value: string; readonly label: string };

// The languages the drills have labels for come first, then the other common deck languages.
const OFFERED: readonly LanguageOption[] = [
  { value: "ja", label: "Japanese" },
  { value: "zh-Hans", label: "Chinese (Simplified)" },
  { value: "zh-Hant", label: "Chinese (Traditional)" },
  { value: "yue", label: "Cantonese" },
  { value: "ko", label: "Korean" },
  { value: "en", label: "English" },
  { value: "id", label: "Indonesian" },
  { value: "ar", label: "Arabic" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "vi", label: "Vietnamese" },
  { value: "th", label: "Thai" },
];

/** The languages offered in the deck form, in the order they are shown. */
export const languageOptions = (): readonly LanguageOption[] => OFFERED;

/** The value the picker shows for a tag: an offered language, or the "other" escape for anything else. */
export const pickerValue = (tag: string): string =>
  OFFERED.some((option) => option.value === tag) ? tag : "other";
