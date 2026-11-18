import type { Drill } from "@voca/contract";

/**
 * The `lang` for a question's prompt: the term's language when the prompt is the term, the reading's own
 * script when it is the reading, and undefined for a meaning, which the session payload has no language for.
 */
export const promptLang = (drill: Drill, termLang: string): string | undefined => {
  throw new Error("not implemented: SF");
};

/** The `lang` for the 4 options, which show the drill's answer field. */
export const answerLang = (drill: Drill, termLang: string): string | undefined => {
  throw new Error("not implemented: SF");
};
