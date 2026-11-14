import { Data } from "effect"

/** The deck doesn't exist, is deleted, or belongs to another Learner: all three look the same from outside. */
export class DeckNotFound extends Data.TaggedError("DeckNotFound")<{}> {}
