// FSRS-6 with the default parameters. Same-day steps and short-term scheduling are not used.

export type Rating = 1 | 2 | 3 | 4 // Again, Hard, Good, Easy

export interface Memory {
  readonly stability: number
  readonly difficulty: number
}

const W = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483,
  0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542
] as const

const DECAY = W[20]
const FACTOR = 0.9 ** (-1 / DECAY) - 1
const MIN_DIFFICULTY = 1
const MAX_DIFFICULTY = 10
const MAX_INTERVAL_DAYS = 36_500
const FUZZ_FROM_DAYS = 3
const FUZZ_RANGE = 0.05

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value))

/** D0(G) before the clamp. The mean reversion target uses it unclamped, which is what the reference vectors expect. */
const rawInitialDifficulty = (rating: Rating): number => W[4] - Math.exp(W[5] * (rating - 1)) + 1

/** The probability of recall after `elapsedDays`, rounded to 8 decimals, as the reference vectors were computed. */
export const retrievability = (elapsedDays: number, stability: number): number => {
  const recall = (1 + (FACTOR * elapsedDays) / stability) ** -DECAY

  return Math.round(recall * 1e8) / 1e8
}

const INITIAL_STABILITY: Record<Rating, number> = { 1: W[0], 2: W[1], 3: W[2], 4: W[3] }

/** The memory of a card created by its first answer. */
export const initialMemory = (rating: Rating): Memory => ({
  stability: INITIAL_STABILITY[rating],
  difficulty: clamp(rawInitialDifficulty(rating), MIN_DIFFICULTY, MAX_DIFFICULTY)
})

const nextDifficulty = (difficulty: number, rating: Rating): number => {
  const delta = -W[6] * (rating - 3)
  const linearDamping = difficulty + (delta * (MAX_DIFFICULTY - difficulty)) / 9
  const reverted = W[7] * rawInitialDifficulty(4) + (1 - W[7]) * linearDamping

  return clamp(reverted, MIN_DIFFICULTY, MAX_DIFFICULTY)
}

/** The memory after a rated answer, `elapsedDays` (fractional) after the last review. */
export const nextMemory = (memory: Memory, elapsedDays: number, rating: Rating): Memory => {
  const { stability, difficulty } = memory
  const recall = retrievability(elapsedDays, stability)

  if (rating === 1) {
    const afterLapse = W[11] * difficulty ** -W[12] * ((stability + 1) ** W[13] - 1) * Math.exp(W[14] * (1 - recall))

    return { stability: Math.min(stability, afterLapse), difficulty: nextDifficulty(difficulty, rating) }
  }

  const hardPenalty = rating === 2 ? W[15] : 1
  const easyBonus = rating === 4 ? W[16] : 1
  const growth =
    Math.exp(W[8]) *
    (11 - difficulty) *
    stability ** -W[9] *
    (Math.exp(W[10] * (1 - recall)) - 1) *
    hardPenalty *
    easyBonus

  return { stability: stability * (1 + growth), difficulty: nextDifficulty(difficulty, rating) }
}

/** Days until the next review for a card of this stability, rounded and clamped to [1, 36500]. No fuzz. */
export const intervalDays = (stability: number, desiredRetention: number): number => {
  const raw = (stability / FACTOR) * (desiredRetention ** (-1 / DECAY) - 1)

  return clamp(Math.round(raw), 1, MAX_INTERVAL_DAYS)
}

/** Intervals of 3 days or more move by up to ±5%. The offset comes from `seed`, so a card always gets the same one. */
export const fuzzInterval = (days: number, seed: string): number => {
  if (days < FUZZ_FROM_DAYS) {
    return days
  }

  const factor = 1 + (unitHash(seed) * 2 - 1) * FUZZ_RANGE

  return clamp(Math.round(days * factor), 1, MAX_INTERVAL_DAYS)
}

/** FNV-1a over the UTF-16 code units, mapped to [0, 1). */
const unitHash = (text: string): number => {
  let hash = 0x811c9dc5

  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0) / 2 ** 32
}

/** Wrong → Again; correct but slower than 8 s → Hard; correct → Good. Never Easy. */
export const ratingFromAnswer = (correct: boolean, latencyMs: number): Rating => {
  if (!correct) {
    return 1
  }

  return latencyMs > 8_000 ? 2 : 3
}
