/** A session counts at most this many seconds per card, so one left open on a desk doesn't skew the pace. */
export const PACE_CAP_SECONDS = 120

/** The median of the sessions' seconds per card, each capped first, or null when there is no session to measure. */
export const medianPace = (secondsPerCard: ReadonlyArray<number>): number | null => {
  if (secondsPerCard.length === 0) {
    return null
  }

  const sorted = secondsPerCard
    .map((seconds) => Math.min(seconds, PACE_CAP_SECONDS))
    .sort((a, b) => a - b)

  // Equal for an odd count, the mean of the two middle values for an even one.
  const low = sorted[Math.floor((sorted.length - 1) / 2)] ?? 0
  const high = sorted[Math.ceil((sorted.length - 1) / 2)] ?? 0

  return (low + high) / 2
}

/** Minutes for `queue` cards at the Learner's pace, rounded; null when the queue is empty or there is no pace yet. */
export const estimateMinutes = (secondsPerCard: ReadonlyArray<number>, queue: number): number | null => {
  const median = medianPace(secondsPerCard)

  if (median === null || queue === 0) {
    return null
  }

  return Math.round((median * queue) / 60)
}
