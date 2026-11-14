import { DRILLS, type Drill, type Field, type WordSlug } from "@voca/contract"

/** A word as study reads it: its id, its text and the keys its answers are compared by. */
export interface StudyWord {
  readonly id: bigint
  readonly slug: WordSlug
  readonly term: string
  readonly reading: string | null
  readonly meaning: string
  readonly termKey: string
  readonly readingKey: string
  readonly meaningKey: string
}

/** The order the drill picker lists drills in. */
export const DRILL_ORDER: ReadonlyArray<Drill> = ["term_meaning", "meaning_term", "term_reading", "reading_term"]

/** A drill applies to a word that has the text for it. A reading drill also needs a reading unlike the term. */
export const appliesTo = (drill: Drill, word: StudyWord): boolean => {
  if (drill === "term_meaning" || drill === "meaning_term") {
    return true
  }

  return word.reading !== null && word.readingKey !== "" && word.readingKey !== word.termKey
}

const keyOf = (word: StudyWord, field: Field): string => {
  if (field === "term") {
    return word.termKey
  }

  if (field === "reading") {
    return word.readingKey
  }

  return word.meaningKey
}

/** The normalized key of the answer a drill asks for: two words with the same key give the same answer. */
export const answerKey = (word: StudyWord, drill: Drill): string => keyOf(word, DRILLS[drill].answer)

/** The text of one field. Readings are asked only where `appliesTo` holds, so the empty fallback never shows. */
export const textOf = (word: StudyWord, field: Field): string => {
  if (field === "term") {
    return word.term
  }

  if (field === "reading") {
    return word.reading ?? ""
  }

  return word.meaning
}
