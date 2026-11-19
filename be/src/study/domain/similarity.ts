import type { Drill } from "@voca/contract"
import type { StudyWord } from "./words.ts"

const KATAKANA_FIRST = 0x30a1
const KATAKANA_LAST = 0x30f6
const KATAKANA_TO_HIRAGANA = 0x60

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })

const graphemesOf = (text: string): Array<string> => Array.from(segmenter.segment(text), (part) => part.segment)

/** The edit distance between two grapheme sequences, one table row at a time. */
const levenshtein = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): number => {
  let previous = Array.from({ length: right.length + 1 }, (_, column) => column)

  for (const [row, leftChar] of left.entries()) {
    const current = [row + 1]

    for (const [column, rightChar] of right.entries()) {
      const substitution = previous[column]! + Number(leftChar !== rightChar)
      const deletion = previous[column + 1]! + 1
      const insertion = current[column]! + 1

      current.push(Math.min(deletion, insertion, substitution))
    }

    previous = current
  }

  return previous[right.length]!
}

/** 1 minus the edit distance over the longer length, so identical texts score 1 and disjoint ones 0. */
const ratio = (left: string, right: string): number => {
  const leftGraphemes = graphemesOf(left)
  const rightGraphemes = graphemesOf(right)
  const longest = Math.max(leftGraphemes.length, rightGraphemes.length)

  if (longest === 0) {
    return 0
  }

  return 1 - levenshtein(leftGraphemes, rightGraphemes) / longest
}

/**
 * Readings compare as sounds: combining marks go (`shì` is `shi`), case is folded and katakana reads as hiragana.
 * This runs only inside the score, so the stored keys stay as they are.
 */
const normalizeReading = (reading: string): string =>
  Array.from(reading.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase(), (char) => {
    const code = char.codePointAt(0)!

    if (code >= KATAKANA_FIRST && code <= KATAKANA_LAST) {
      return String.fromCodePoint(code - KATAKANA_TO_HIRAGANA)
    }

    return char
  }).join("")

const orthographic = (left: StudyWord, right: StudyWord): number => ratio(left.termKey, right.termKey)

/** A missing reading scores 0, so words without one never look alike by sound. */
const phonetic = (left: StudyWord, right: StudyWord): number => {
  const leftReading = normalizeReading(left.readingKey)
  const rightReading = normalizeReading(right.readingKey)

  if (leftReading === "" || rightReading === "") {
    return 0
  }

  return ratio(leftReading, rightReading)
}

/** How alike two words look or sound, from 0 to 1: the larger of the spelling and the reading score. */
export const similarity = (left: StudyWord, right: StudyWord): number =>
  Math.max(orthographic(left, right), phonetic(left, right))

/**
 * The score a hard question ranks distractors by. A reading question compares readings only, so a word whose term
 * looks like the prompt's term does not leak into the options.
 */
export const scoreFor = (drill: Drill, prompt: StudyWord, candidate: StudyWord): number =>
  drill === "term_reading" ? phonetic(prompt, candidate) : similarity(prompt, candidate)
