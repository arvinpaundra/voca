import { DRILLS, readingLang, type Drill, type Field } from "@voca/contract";

// A term is in the deck's language, a reading in its own script, and a meaning has no language in the payload.
const langOf = (field: Field, termLang: string): string | undefined => {
  if (field === "term") return termLang;
  if (field === "reading") return readingLang(termLang);

  return undefined;
};

/**
 * The `lang` for a question's prompt: the term's language when the prompt is the term, the reading's own
 * script when it is the reading, and undefined for a meaning, which the session payload has no language for.
 */
export const promptLang = (drill: Drill, termLang: string): string | undefined =>
  langOf(DRILLS[drill].prompt, termLang);

/** The `lang` for the 4 options, which show the drill's answer field. */
export const answerLang = (drill: Drill, termLang: string): string | undefined =>
  langOf(DRILLS[drill].answer, termLang);
