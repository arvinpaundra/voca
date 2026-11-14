export type Segment = "right" | "wrong" | "pending";

/** One segment per word of the session: each word's first attempt in order, then the words still to come. */
export const segments = (_size: number, _firstAttempts: readonly boolean[]): Segment[] => {
  throw new Error("not implemented: SF");
};

/** First attempts right and wrong, and the share right (null before any answer). */
export const tally = (
  _firstAttempts: readonly boolean[]
): { readonly right: number; readonly wrong: number; readonly accuracy: number | null } => {
  throw new Error("not implemented: SF");
};
