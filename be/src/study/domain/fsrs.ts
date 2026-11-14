import { Effect } from "effect"

export type Rating = 1 | 2 | 3 | 4 // Again, Hard, Good, Easy

export interface Memory {
  readonly stability: number
  readonly difficulty: number
}

const notImplemented = (): never => Effect.runSync(Effect.die("not implemented: SB"))

/** The memory of a card created by its first answer. */
export const initialMemory = (_rating: Rating): Memory => notImplemented()

/** The memory after a rated answer, `elapsedDays` (fractional) after the last review. Same-day steps are not used. */
export const nextMemory = (_memory: Memory, _elapsedDays: number, _rating: Rating): Memory => notImplemented()

/** The probability of recall after `elapsedDays`. */
export const retrievability = (_elapsedDays: number, _stability: number): number => notImplemented()

/** Days until the next review, rounded and clamped to [1, 36500]. No fuzz. */
export const intervalDays = (_stability: number, _desiredRetention: number): number => notImplemented()

/** Wrong → Again; correct but slower than 8 s → Hard; correct → Good. Never Easy. */
export const ratingFromAnswer = (_correct: boolean, _latencyMs: number): Rating => notImplemented()
