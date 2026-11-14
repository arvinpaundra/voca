import { Data } from "effect"

/** The deck doesn't exist, is deleted, or belongs to another Learner: all three look the same from outside. */
export class DeckNotFound extends Data.TaggedError("DeckNotFound")<{}> {}

/** Same as `DeckNotFound`, for a word. */
export class WordNotFound extends Data.TaggedError("WordNotFound")<{}> {}

/** The deck already holds a word with the same normalized term and reading. */
export class DuplicateWordError extends Data.TaggedError("DuplicateWordError")<{}> {}

/** A deck's term language can't change once it has words. */
export class TermLangLocked extends Data.TaggedError("TermLangLocked")<{}> {}

/** Only a public deck can be forked. Over HTTP it answers 404 like a missing deck, so a private one does not reveal itself. */
export class DeckNotPublic extends Data.TaggedError("DeckNotPublic")<{}> {}
