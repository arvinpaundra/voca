import { Effect, Random } from "effect"
import { OPTIONS_PER_QUESTION, type Drill, type Mode } from "@voca/contract"
import { DeckTooSmallError } from "./errors.ts"
import { appliesTo, answerKey, type StudyWord } from "./words.ts"

/**
 * Hard words: each word is asked once, in the drill where its hard card is most overdue. Due words come first, most
 * overdue first, then the rest by due. `due` is epoch milliseconds; a card is due before `dueBefore`.
 */
export const pickHard = <T extends { readonly wordId: bigint; readonly due: number }>(input: {
  readonly cards: ReadonlyArray<T>
  readonly dueBefore: number
  readonly size: number
}): Array<T> => {
  const earliest = new Map<bigint, T>()

  for (const card of input.cards) {
    const current = earliest.get(card.wordId)

    if (current === undefined || card.due < current.due) {
      earliest.set(card.wordId, card)
    }
  }

  const isDue = (card: T): boolean => card.due < input.dueBefore

  return [...earliest.values()]
    .sort((a, b) => Number(isDue(b)) - Number(isDue(a)) || a.due - b.due)
    .slice(0, input.size)
}

/** One word asked in one drill. */
export interface Pick {
  readonly word: StudyWord
  readonly drill: Drill
}

/** A card's key in the due index: one card per word and drill. */
export const cardKey = (wordId: bigint, drill: Drill): string => `${wordId}:${drill}`

/**
 * Due words first, most overdue first. Each word is asked once, in the drill where its card is most overdue.
 * `dueAt` holds epoch milliseconds per card key; a card is due when it is before `dueBefore`.
 */
export const pickDue = (input: {
  readonly words: ReadonlyArray<StudyWord>
  readonly dueAt: ReadonlyMap<string, number>
  readonly drills: ReadonlyArray<Drill>
  readonly dueBefore: number
  readonly size: number
}): Array<{ readonly pick: Pick; readonly due: number }> => {
  const due: Array<{ readonly pick: Pick; readonly due: number }> = []

  for (const word of input.words) {
    let earliest: { readonly drill: Drill; readonly due: number } | null = null

    for (const drill of input.drills) {
      if (!appliesTo(drill, word)) {
        continue
      }

      const at = input.dueAt.get(cardKey(word.id, drill))

      if (at === undefined || at >= input.dueBefore) {
        continue
      }

      if (earliest === null || at < earliest.due) {
        earliest = { drill, due: at }
      }
    }

    if (earliest !== null) {
      due.push({ pick: { word, drill: earliest.drill }, due: earliest.due })
    }
  }

  // A stable sort keeps the deck's order between words due at the same instant.
  return due.sort((a, b) => a.due - b.due).slice(0, input.size)
}

/**
 * New words: round-robin over the drills, each time taking the oldest word that the drill applies to, has no card in
 * that drill and isn't taken yet. Stops at `limit`, which may be zero or negative.
 */
export const pickNew = (input: {
  readonly words: ReadonlyArray<StudyWord>
  readonly hasCard: (wordId: bigint, drill: Drill) => boolean
  readonly drills: ReadonlyArray<Drill>
  readonly taken: ReadonlySet<bigint>
  readonly limit: number
}): Array<Pick> => {
  const picks: Array<Pick> = []
  const taken = new Set(input.taken)
  let progressed = true

  while (picks.length < input.limit && progressed) {
    progressed = false

    for (const drill of input.drills) {
      if (picks.length >= input.limit) {
        break
      }

      const word = input.words.find(
        (candidate) => !taken.has(candidate.id) && appliesTo(drill, candidate) && !input.hasCard(candidate.id, drill)
      )

      if (word === undefined) {
        continue
      }

      taken.add(word.id)
      picks.push({ word, drill })
      progressed = true
    }
  }

  return picks
}

/**
 * The 4 options of a question: the prompt word and 3 distractors in random order. A distractor comes from the deck, has
 * the drill's answer, and has an answer key the prompt's answer doesn't share, one per key.
 */
export const pickOptions = (
  words: ReadonlyArray<StudyWord>,
  drill: Drill,
  prompt: StudyWord,
  mode: Mode
): Effect.Effect<ReadonlyArray<StudyWord>, DeckTooSmallError> =>
  Effect.gen(function* () {
    if (mode === "hard") {
      return yield* Effect.die("not implemented: SB")
    }

    const promptKey = answerKey(prompt, drill)
    const seen = new Set<string>()
    const candidates: Array<StudyWord> = []

    for (const word of words) {
      if (word.id === prompt.id || !appliesTo(drill, word)) {
        continue
      }

      const key = answerKey(word, drill)

      if (key === promptKey || seen.has(key)) {
        continue
      }

      seen.add(key)
      candidates.push(word)
    }

    if (candidates.length < OPTIONS_PER_QUESTION - 1) {
      return yield* Effect.fail(new DeckTooSmallError())
    }

    const distractors = (yield* Random.shuffle(candidates)).slice(0, OPTIONS_PER_QUESTION - 1)

    return yield* Random.shuffle([prompt, ...distractors])
  })
