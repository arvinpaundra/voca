import { DRILLS, drillLabel, type Drill, type LangTag, type Question } from "@voca/contract"
import { type StudyWord, textOf } from "./words.ts"

/** The question the Learner sees: the prompt, the drill's direction and the options in the order they are shown. */
export const questionOf = (input: {
  readonly position: number
  readonly attempt: number
  readonly drill: Drill
  readonly word: StudyWord
  readonly options: ReadonlyArray<StudyWord>
  readonly termLang: LangTag
}): Question => {
  const { drill, word } = input

  return {
    position: input.position,
    attempt: input.attempt,
    wordSlug: word.slug,
    drill,
    drillLabel: drillLabel(input.termLang, drill),
    prompt: {
      text: textOf(word, DRILLS[drill].prompt),
      ruby: "not implemented: BS"
    },
    options: input.options.map((option) => ({
      wordSlug: option.slug,
      text: textOf(option, DRILLS[drill].answer)
    }))
  }
}
