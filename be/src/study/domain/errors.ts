import { Data } from "effect"

/** The deck doesn't exist, is deleted, or belongs to another Learner: all three look the same from outside. */
export class DeckNotFound extends Data.TaggedError("DeckNotFound")<{}> {}

/** The session doesn't exist or belongs to another Learner. */
export class SessionNotFound extends Data.TaggedError("SessionNotFound")<{}> {}

/** The session has no question at that position. */
export class QuestionNotFound extends Data.TaggedError("QuestionNotFound")<{}> {}

/** The question was answered already: a second answer to the same question is refused. */
export class QuestionAlreadyAnswered extends Data.TaggedError("QuestionAlreadyAnswered")<{}> {}

/** The session was completed or abandoned, so it takes no more answers. */
export class SessionNotActive extends Data.TaggedError("SessionNotActive")<{}> {}

/** The deck has fewer than 3 other words to offer as wrong options for a question. */
export class DeckTooSmallError extends Data.TaggedError("DeckTooSmallError")<{}> {}

/** None of the drills asked for applies to any word of the deck. */
export class DrillNotAvailableError extends Data.TaggedError("DrillNotAvailableError")<{}> {}

/** No word is due and no new word is left for today, so the session builder picked nothing. */
export class NothingToStudyError extends Data.TaggedError("NothingToStudyError")<{}> {}

/** The Learner has no Card for this word in that drill (never studied there), or the word is not theirs. */
export class CardNotFound extends Data.TaggedError("CardNotFound")<{}> {}
