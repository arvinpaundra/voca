export type Segment = "right" | "wrong" | "pending";

/** One segment per word of the session: each word's first attempt in order, then the words still to come. */
export const segments = (size: number, firstAttempts: readonly boolean[]): Segment[] => {
  const rated = firstAttempts.slice(0, size).map((correct): Segment => (correct ? "right" : "wrong"));

  const pending = Array.from({ length: Math.max(0, size - rated.length) }, (): Segment => "pending");

  return [...rated, ...pending];
};

/** First attempts right and wrong, and the share right (null before any answer). */
export const tally = (
  firstAttempts: readonly boolean[]
): { readonly right: number; readonly wrong: number; readonly accuracy: number | null } => {
  const right = firstAttempts.filter(Boolean).length;
  const wrong = firstAttempts.length - right;

  return {
    right,
    wrong,
    accuracy: firstAttempts.length === 0 ? null : right / firstAttempts.length
  };
};
