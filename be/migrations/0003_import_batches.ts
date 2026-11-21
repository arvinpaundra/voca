import { Effect } from "effect"
import { SqlClient } from "effect/sql"

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // A batch of CSV files, each imported into a new deck by the background worker.
  yield* sql`CREATE TABLE import_batches (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug          text NOT NULL UNIQUE,
    learner_id    bigint NOT NULL REFERENCES learners,
    term_lang     text NOT NULL,
    meaning_lang  text NOT NULL,
    created_at    timestamptz NOT NULL,
    dismissed_at  timestamptz
  )`
  yield* sql`CREATE INDEX ON import_batches (learner_id, created_at DESC) WHERE dismissed_at IS NULL`

  // The file's bytes wait here until the worker has imported it; `content` is then cleared.
  yield* sql`CREATE TABLE import_files (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    batch_id            bigint NOT NULL REFERENCES import_batches,
    position            smallint NOT NULL,
    name                text NOT NULL,
    content             bytea,
    status              text NOT NULL,
    deck_id             bigint REFERENCES decks,
    imported            integer NOT NULL,
    skipped_duplicates  integer NOT NULL,
    errors              jsonb NOT NULL,
    total_errors        integer NOT NULL,
    UNIQUE (batch_id, position)
  )`
})
