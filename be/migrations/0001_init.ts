import { Effect } from "effect"
import { SqlClient } from "effect/sql"

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // ─── Identity ───
  yield* sql`CREATE TABLE learners (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug                 text NOT NULL UNIQUE,
    google_sub           text NOT NULL,
    email                text NOT NULL,
    name                 text NOT NULL,
    avatar_url           text,
    timezone             text NOT NULL,
    day_start_hour       smallint NOT NULL,
    desired_retention    double precision NOT NULL,
    new_per_day          smallint NOT NULL,
    default_session_size smallint NOT NULL,
    default_mode         text NOT NULL,
    created_at           timestamptz NOT NULL,
    deleted_at           timestamptz
  )`
  yield* sql`CREATE UNIQUE INDEX learners_google_sub ON learners (google_sub) WHERE deleted_at IS NULL`

  yield* sql`CREATE TABLE refresh_tokens (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    learner_id  bigint NOT NULL REFERENCES learners,
    family_id   uuid NOT NULL,
    token_hash  bytea NOT NULL UNIQUE,
    expires_at  timestamptz NOT NULL,
    used_at     timestamptz,
    revoked_at  timestamptz,
    created_at  timestamptz NOT NULL
  )`
  yield* sql`CREATE INDEX ON refresh_tokens (family_id)`
  yield* sql`CREATE INDEX ON refresh_tokens (expires_at)`

  // ─── Library ───
  yield* sql`CREATE TABLE decks (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug           text NOT NULL UNIQUE,
    owner_id       bigint NOT NULL REFERENCES learners,
    title          text NOT NULL,
    description    text NOT NULL,
    term_lang      text NOT NULL,
    meaning_lang   text NOT NULL,
    visibility     text NOT NULL,
    published_at   timestamptz,
    forked_from_id bigint REFERENCES decks,
    fork_count     integer NOT NULL,
    created_at     timestamptz NOT NULL,
    updated_at     timestamptz NOT NULL,
    deleted_at     timestamptz
  )`
  yield* sql`CREATE INDEX ON decks (owner_id, created_at DESC) WHERE deleted_at IS NULL`
  yield* sql`CREATE INDEX ON decks (published_at DESC) WHERE visibility = 'public' AND deleted_at IS NULL`
  yield* sql`CREATE INDEX ON decks (fork_count DESC) WHERE visibility = 'public' AND deleted_at IS NULL`

  yield* sql`CREATE TABLE words (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug         text NOT NULL UNIQUE,
    deck_id      bigint NOT NULL REFERENCES decks,
    term         text NOT NULL,
    reading      text,
    meaning      text NOT NULL,
    example      text,
    notes        text,
    term_key     text NOT NULL,
    reading_key  text NOT NULL,
    meaning_key  text NOT NULL,
    created_at   timestamptz NOT NULL,
    deleted_at   timestamptz
  )`
  yield* sql`CREATE UNIQUE INDEX words_unique_term ON words (deck_id, term_key, reading_key) WHERE deleted_at IS NULL`
  yield* sql`CREATE INDEX ON words (deck_id, created_at) WHERE deleted_at IS NULL`

  // ─── Study ───
  yield* sql`CREATE TABLE cards (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    word_id      bigint NOT NULL REFERENCES words,
    drill        text NOT NULL,
    learner_id   bigint NOT NULL REFERENCES learners,
    stability    double precision NOT NULL,
    difficulty   double precision NOT NULL,
    due          timestamptz NOT NULL,
    last_review  timestamptz NOT NULL,
    reps         integer NOT NULL,
    lapses       integer NOT NULL,
    is_hard      boolean NOT NULL,
    deleted_at   timestamptz
  )`
  yield* sql`CREATE UNIQUE INDEX cards_word_drill ON cards (word_id, drill) WHERE deleted_at IS NULL`
  yield* sql`CREATE INDEX ON cards (learner_id, drill, due) WHERE deleted_at IS NULL`
  yield* sql`CREATE INDEX ON cards (learner_id, drill) WHERE is_hard AND deleted_at IS NULL`

  yield* sql`CREATE TABLE study_sessions (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug          text NOT NULL UNIQUE,
    learner_id    bigint NOT NULL REFERENCES learners,
    scope_deck_id bigint REFERENCES decks,
    drills        text[] NOT NULL,
    mode          text NOT NULL,
    size          smallint NOT NULL,
    status        text NOT NULL,
    created_at    timestamptz NOT NULL,
    ended_at      timestamptz
  )`
  yield* sql`CREATE UNIQUE INDEX one_active_session ON study_sessions (learner_id) WHERE status = 'active'`

  yield* sql`CREATE TABLE session_questions (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id     bigint NOT NULL REFERENCES study_sessions,
    position       smallint NOT NULL,
    word_id        bigint NOT NULL REFERENCES words,
    drill          text NOT NULL,
    attempt        smallint NOT NULL,
    option_ids     bigint[] NOT NULL,
    answered_at    timestamptz,
    chosen_word_id bigint,
    correct        boolean,
    latency_ms     integer
  )`
  yield* sql`CREATE UNIQUE INDEX ON session_questions (session_id, position)`
  yield* sql`CREATE UNIQUE INDEX ON session_questions (session_id, word_id, attempt)`
  yield* sql`CREATE UNIQUE INDEX one_pending_per_word ON session_questions (session_id, word_id) WHERE answered_at IS NULL`
  yield* sql`CREATE INDEX ON session_questions (word_id) WHERE correct = false`

  yield* sql`CREATE TABLE reviews (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    word_id           bigint NOT NULL REFERENCES words,
    drill             text NOT NULL,
    learner_id        bigint NOT NULL REFERENCES learners,
    session_id        bigint REFERENCES study_sessions,
    reviewed_at       timestamptz NOT NULL,
    rating            smallint NOT NULL,
    correct           boolean NOT NULL,
    mode              text NOT NULL,
    latency_ms        integer NOT NULL,
    chosen_word_id    bigint,
    state_before      text NOT NULL,
    elapsed_days      real,
    retrievability    real,
    stability_before  double precision,
    difficulty_before double precision,
    stability_after   double precision NOT NULL,
    difficulty_after  double precision NOT NULL,
    scheduled_days    integer NOT NULL
  )`
  yield* sql`CREATE UNIQUE INDEX ON reviews (session_id, word_id)`
  yield* sql`CREATE INDEX ON reviews (word_id, drill, reviewed_at)`
  yield* sql`CREATE INDEX ON reviews (learner_id, reviewed_at)`
}).pipe(Effect.asVoid)
