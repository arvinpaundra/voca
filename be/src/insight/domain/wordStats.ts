/** How many of the latest first attempts the recent accuracy and the answer time look at. */
export const RECENT_REVIEWS = 10

/** How many of the latest first attempts the history lists. */
export const HISTORY_REVIEWS = 50

/** How many sessions the attempts-to-clear average looks at. */
export const RECENT_SESSIONS = 10

/** How many wrong picks `confusedWith` lists. */
export const CONFUSED_WITH_LIMIT = 3

/** A card is mature from this many days of stability. */
export const MATURE_DAYS = 21

/** A card with this many lapses or more is a leech. */
export const LEECH_LAPSES = 4

const DAY_MS = 86_400_000

export const maturityOf = (stabilityDays: number): "learning" | "mature" =>
  stabilityDays >= MATURE_DAYS ? "mature" : "learning"

export const isLeech = (lapses: number): boolean => lapses >= LEECH_LAPSES

/** Fractional days from `from` to `to`, never negative. */
export const daysBetween = (from: Date, to: Date): number => Math.max(0, (to.getTime() - from.getTime()) / DAY_MS)

/** The share of correct attempts, or null with none. */
export const accuracy = (attempts: ReadonlyArray<{ readonly correct: boolean }>): number | null =>
  attempts.length === 0 ? null : attempts.filter((attempt) => attempt.correct).length / attempts.length

/** How many attempts in a row are correct, counting back from the newest (the list is newest first). */
export const streak = (newestFirst: ReadonlyArray<{ readonly correct: boolean }>): number => {
  const firstWrong = newestFirst.findIndex((attempt) => !attempt.correct)

  return firstWrong === -1 ? newestFirst.length : firstWrong
}

/** The middle value (the rounded mean of the two middle ones when even), or null with none. */
export const median = (values: ReadonlyArray<number>): number | null => {
  if (values.length === 0) {
    return null
  }

  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 1 ? sorted[middle]! : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
}

/** The most picked words first; equal counts go to the lower id so the ranking never flips between reads. */
export const rankConfusions = (
  wordIds: ReadonlyArray<bigint>,
  limit: number = CONFUSED_WITH_LIMIT
): ReadonlyArray<{ readonly wordId: bigint; readonly count: number }> => {
  const counts = new Map<bigint, number>()

  for (const wordId of wordIds) {
    counts.set(wordId, (counts.get(wordId) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([wordId, count]) => ({ wordId, count }))
    .sort((a, b) => b.count - a.count || (a.wordId < b.wordId ? -1 : a.wordId > b.wordId ? 1 : 0))
    .slice(0, limit)
}

/** The answers it took to get the word right in one session (in answer order), or null when it never was. */
export const attemptsUntilCorrect = (answers: ReadonlyArray<{ readonly correct: boolean }>): number | null => {
  const cleared = answers.findIndex((answer) => answer.correct)

  return cleared === -1 ? null : cleared + 1
}

/** The mean over the sessions that cleared the word, or null when none did. */
export const meanAttempts = (perSession: ReadonlyArray<number | null>): number | null => {
  const cleared = perSession.filter((attempts): attempts is number => attempts !== null)

  return cleared.length === 0 ? null : cleared.reduce((sum, attempts) => sum + attempts, 0) / cleared.length
}
