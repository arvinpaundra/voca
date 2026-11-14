import { Schema } from "effect"

/**
 * HTTP-facing errors: `{ _tag, message }`, each with its HTTP status.
 * Request bodies that fail Schema decoding get Effect's built-in empty `400`;
 * the frontend validates with these same Schemas before sending, so a 400 means a client bug.
 */
const fields = { message: Schema.String }

export class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", fields, { httpApiStatus: 401 }) {}

export class RefreshTokenInvalid extends Schema.TaggedError<RefreshTokenInvalid>()(
  "RefreshTokenInvalid", fields, { httpApiStatus: 401 }
) {}

/** Only for actions on a public deck the Learner does not own; everything else owned by others is `NotFound`. */
export class Forbidden extends Schema.TaggedError<Forbidden>()("Forbidden", fields, { httpApiStatus: 403 }) {}

export class NotFound extends Schema.TaggedError<NotFound>()("NotFound", fields, { httpApiStatus: 404 }) {}

/** 404, so forking a private deck does not reveal that it exists. */
export class DeckNotPublic extends Schema.TaggedError<DeckNotPublic>()("DeckNotPublic", fields, { httpApiStatus: 404 }) {}

export class DuplicateWord extends Schema.TaggedError<DuplicateWord>()("DuplicateWord", fields, { httpApiStatus: 409 }) {}

export class QuestionAlreadyAnswered extends Schema.TaggedError<QuestionAlreadyAnswered>()(
  "QuestionAlreadyAnswered", fields, { httpApiStatus: 409 }
) {}

export class SessionNotActive extends Schema.TaggedError<SessionNotActive>()(
  "SessionNotActive", fields, { httpApiStatus: 409 }
) {}

export class DrillNotAvailable extends Schema.TaggedError<DrillNotAvailable>()(
  "DrillNotAvailable", fields, { httpApiStatus: 400 }
) {}

export class DeckTooSmall extends Schema.TaggedError<DeckTooSmall>()("DeckTooSmall", fields, { httpApiStatus: 422 }) {}

export const ImportRowError = Schema.Struct({
  row: Schema.Int,
  column: Schema.NullOr(Schema.String),
  message: Schema.String
})

export class ImportRejected extends Schema.TaggedError<ImportRejected>()(
  "ImportRejected",
  { message: Schema.String, errors: Schema.Array(ImportRowError), totalErrors: Schema.Int }, // errors: first 100
  { httpApiStatus: 422 }
) {}

export class PayloadTooLarge extends Schema.TaggedError<PayloadTooLarge>()("PayloadTooLarge", fields, { httpApiStatus: 413 }) {}
