# 06 — Data Model (PostgreSQL)

Requirements: **PostgreSQL 18.3** (the cluster instance; the schema itself needs only 13 or later), no extensions. Migrations are numbered TypeScript files run by the `effect/sql` `Migrator` at boot. The Migrator takes a lock, so it is safe if two pods ever start at the same time.

## Rules

1. **Invariants live in code, not the database.** There are no `CHECK` constraints. Every domain rule (session sizes, retention range, Card state consistency, text lengths, enum values) is an Effect `Schema` or a domain function in `be/src/*/domain/`. The rules are enforced in two places:
   - **On the way in:** request bodies are decoded with `contract/` Schemas, and use cases build values only through domain constructors. For example, `SessionSize` is `Schema.Literals([7, 10, 15, 20])`.
   - **On the way out of the database:** every row is decoded with `SqlSchema` into the same domain Schemas. A row that breaks a rule (say, someone edited it by hand) fails loudly with a decode error. It is never silently trusted.

2. **Only concurrency guards stay in the database.** That means `UNIQUE` indexes, `NOT NULL`, and foreign keys. Application code cannot guarantee uniqueness under concurrent requests without locks, and a unique index is the cheapest lock. Each unique index below says which race it prevents. Foreign keys use the default `NO ACTION` (no cascades). With soft delete, parent rows are never physically deleted, so these keys never block a normal operation; they only catch bugs.

3. **Soft delete, no cascades.** Deletable entities have `deleted_at timestamptz` (NULL means live). A "cascade" is an explicit application step inside one transaction ([Delete semantics](#delete-semantics)). Every read goes through repository functions that add `deleted_at IS NULL`. Partial indexes keep deleted rows out of hot indexes, so soft-deleted rows cost nothing on reads.

## Identifiers: internal `bigint`, external slug

Every table's primary key is `id bigint GENERATED ALWAYS AS IDENTITY`. Foreign keys and joins use it, because it is small (8 B), indexes well, and is **never exposed** outside the server.

Every entity the API exposes also has a **slug**. The slug is used everywhere outside the server: URLs, request and response bodies, and the JWT `sub`.

| Entity | Slug length | Random bits | Example | URL |
|---|---|---|---|---|
| Learner | 8 | 40 | `K7Q2M9XD` | — (only in `sub`) |
| Deck | 10 | 50 | `TQ7KM2PV9X` | `/decks/TQ7KM2PV9X` |
| Word (and its Cards) | 12 | 60 | `4HNCR8WYK2JD` | `/words/4HNCR8WYK2JD` |
| Session | 14 | 70 | `G7PX2MQ9VB4KR8` | `/sessions/G7PX2MQ9VB4KR8` |

- **Format:** random, **uppercase** [Crockford base32](https://www.crockford.com/base32.html) (`0-9 A-H J K M N P-T V-Z`). There is no prefix. The alphabet has no `I`, `L`, `O`, or `U`, so slugs are easy to read aloud and copy.
- **Length depends on the model.** Collisions are retried, so a slug only needs to be long enough that a single insert almost never collides, even when the table is full. The chance for one insert is `rows / 32^length`:
  - Learner: about 1 in 1,000,000 at 1M learners
  - Deck: about 1 in 100,000,000 at 10M decks
  - Word: about 1 in 10,000,000,000 at 100M words
  - Session: about 1 in 1,000,000,000,000 at 1B sessions Distinct lengths also act as a free type check: a deck slug can never be passed where a word slug is expected.
- **Storage:** `slug text NOT NULL UNIQUE`. The unique index is the collision guard.
- **Generation:** in the app, in `contract/src/slug.ts` (~15 lines, no dependency):
  - `crypto.getRandomValues(n bytes)`, and each byte `& 31` indexes the alphabet. 32 divides 256, so there is no modulo bias.
  - The random source is an Effect service, so tests can seed it.
  - Bulk inserts (import, fork) generate slugs in the app and pass them through `unnest`.
- **Collision:** a `23505` violation on a `*_slug` index makes infrastructure regenerate the slugs and retry the statement once. For bulk inserts it retries the whole transaction. Two collisions in a row are reported as a defect.
- **Boundary:** `DeckSlug` (`contract/src/slug.ts`) is a Schema that uppercases its input, so a pasted lowercase slug still works, and then checks `^[0-9A-HJKMNP-TV-Z]{10}$`. It decodes to a branded `DeckSlug`. A wrong length or a bad character → `400`.
- **Resolving:** the slug is looked up in the same query as the ownership check and the `deleted_at IS NULL` filter. Internal IDs never leave infrastructure.
- **No information leaks:** slugs are fully random, so unlike a ULID or a sequential ID, they reveal neither the creation time nor how many rows exist.

## Schema

```sql
-- ───────────── Identity ─────────────
CREATE TABLE learners (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug                 text NOT NULL UNIQUE,                 -- 8 chars, Crockford base32
  google_sub           text NOT NULL,
  email                text NOT NULL,
  name                 text NOT NULL,
  avatar_url           text,
  timezone             text NOT NULL,          -- IANA            (Timezone schema)
  day_start_hour       smallint NOT NULL,      -- 0..23           (DayStartHour schema)
  desired_retention    real NOT NULL,          -- 0.80..0.95      (DesiredRetention schema)
  new_per_day          smallint NOT NULL,      -- 0..200          (NewPerDay schema)
  default_session_size smallint NOT NULL,      -- 7|10|15|20      (SessionSize schema)
  default_mode         text NOT NULL,          -- easy|hard       (Mode schema)
  created_at           timestamptz NOT NULL,
  deleted_at           timestamptz
);
-- race: two simultaneous first sign-ins of the same Google account
CREATE UNIQUE INDEX learners_google_sub ON learners (google_sub) WHERE deleted_at IS NULL;

CREATE TABLE refresh_tokens (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  learner_id  bigint NOT NULL REFERENCES learners,
  family_id   uuid NOT NULL,
  token_hash  bytea NOT NULL UNIQUE,     -- lookup key; sha256 collisions are impossible in practice
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL
);
CREATE INDEX ON refresh_tokens (family_id);
CREATE INDEX ON refresh_tokens (expires_at);

-- ───────────── Library ─────────────
CREATE TABLE decks (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug           text NOT NULL UNIQUE,                 -- 10 chars, Crockford base32
  owner_id       bigint NOT NULL REFERENCES learners,
  title          text NOT NULL,                        -- 1..120   (DeckTitle schema)
  description    text NOT NULL,                        -- ≤ 2000
  term_lang      text NOT NULL,                        -- BCP-47   (LangTag schema)
  meaning_lang   text NOT NULL,
  visibility     text NOT NULL,                        -- private|public
  published_at   timestamptz,                          -- set iff public (Deck domain)
  forked_from_id bigint REFERENCES decks,
  fork_count     integer NOT NULL,
  created_at     timestamptz NOT NULL,
  updated_at     timestamptz NOT NULL,
  deleted_at     timestamptz
);
CREATE INDEX ON decks (owner_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX ON decks (published_at DESC) WHERE visibility = 'public' AND deleted_at IS NULL;
CREATE INDEX ON decks (fork_count DESC)  WHERE visibility = 'public' AND deleted_at IS NULL;

CREATE TABLE words (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug         text NOT NULL UNIQUE,              -- 12 chars, Crockford base32
  deck_id      bigint NOT NULL REFERENCES decks,
  term         text NOT NULL,                     -- 1..200  (Term schema)
  reading      text,                              -- ≤ 200; ja: hiragana, zh: pinyin, yue: jyutping ([14](14-drills.md))
  meaning      text NOT NULL,                     -- 1..500
  example      text,                              -- ≤ 1000
  notes        text,                              -- ≤ 2000
  term_key     text NOT NULL,                     -- normalizeKey(term)
  reading_key  text NOT NULL,                     -- normalizeKey(reading) or ''
  meaning_key  text NOT NULL,                     -- normalizeKey(meaning)
  created_at   timestamptz NOT NULL,
  deleted_at   timestamptz
);
-- race: concurrent add/import of the same term; also the ON CONFLICT target for imports.
-- Partial ⇒ a deleted word can be re-added.
CREATE UNIQUE INDEX words_unique_term ON words (deck_id, term_key, reading_key) WHERE deleted_at IS NULL;
CREATE INDEX ON words (deck_id, created_at) WHERE deleted_at IS NULL;

-- ───────────── Study ─────────────
-- One Card per (word, drill), created lazily on the first answer. No row ⇒ "new in that drill".
CREATE TABLE cards (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  word_id      bigint NOT NULL REFERENCES words,
  drill        text NOT NULL,                     -- term_meaning | meaning_term | term_reading | reading_term
  learner_id   bigint NOT NULL REFERENCES learners,
  stability    double precision NOT NULL,
  difficulty   double precision NOT NULL,
  due          timestamptz NOT NULL,
  last_review  timestamptz NOT NULL,
  reps         integer NOT NULL,
  lapses       integer NOT NULL,
  is_hard      boolean NOT NULL,
  deleted_at   timestamptz                        -- mirrors its word; keeps hot indexes clean
);
-- race: two concurrent first answers creating the same (word, drill) card
CREATE UNIQUE INDEX cards_word_drill ON cards (word_id, drill) WHERE deleted_at IS NULL;
CREATE INDEX ON cards (learner_id, drill, due) WHERE deleted_at IS NULL;
CREATE INDEX ON cards (learner_id, drill) WHERE is_hard AND deleted_at IS NULL;

CREATE TABLE study_sessions (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug          text NOT NULL UNIQUE,                 -- 14 chars, Crockford base32
  learner_id    bigint NOT NULL REFERENCES learners,
  scope_deck_id bigint REFERENCES decks,              -- null ⇒ hard-words scope
  drills        text[] NOT NULL,                      -- selected drill set (FR-17), non-empty
  mode          text NOT NULL,
  size          smallint NOT NULL,                    -- distinct words, not attempts
  status        text NOT NULL,                        -- active|completed|abandoned
  created_at    timestamptz NOT NULL,
  ended_at      timestamptz
);
-- race: two tabs pressing "Start" at once
CREATE UNIQUE INDEX one_active_session ON study_sessions (learner_id) WHERE status = 'active';

-- One row per shown question (attempt). Append-only log: no deleted_at.
CREATE TABLE session_questions (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id     bigint NOT NULL REFERENCES study_sessions,
  position       smallint NOT NULL,
  word_id        bigint NOT NULL REFERENCES words,
  drill          text NOT NULL,                       -- ∈ session.drills; same for all attempts of a word
  attempt        smallint NOT NULL,
  option_ids     bigint[] NOT NULL,                   -- 4 words.id; displayed value = word's drill.answer field
  answered_at    timestamptz,
  chosen_word_id bigint,
  correct        boolean,
  latency_ms     integer
);
-- race: two answers creating retries concurrently
CREATE UNIQUE INDEX ON session_questions (session_id, position);
CREATE UNIQUE INDEX ON session_questions (session_id, word_id, attempt);
-- race: double submit producing two pending retries for one word (FR-13)
CREATE UNIQUE INDEX one_pending_per_word ON session_questions (session_id, word_id) WHERE answered_at IS NULL;
CREATE INDEX ON session_questions (word_id) WHERE correct = false;   -- "confused with"

-- Scheduling log: one row per word per session (the first attempt). Append-only: no deleted_at.
CREATE TABLE reviews (
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
  state_before      text NOT NULL,            -- new (no card existed) | review
  elapsed_days      real,
  retrievability    real,
  stability_before  double precision,
  difficulty_before double precision,
  stability_after   double precision NOT NULL,
  difficulty_after  double precision NOT NULL,
  scheduled_days    integer NOT NULL
);
-- race: double submit of attempt 1 scheduling the card twice
CREATE UNIQUE INDEX ON reviews (session_id, word_id);
CREATE INDEX ON reviews (word_id, drill, reviewed_at);
CREATE INDEX ON reviews (learner_id, reviewed_at);     -- activity heatmap, deck stats
```

Defaults such as `now()` and `false` are not set in the database. The app supplies every value through its constructor, so the domain is the single source of defaults. A unique violation (`23505`) is mapped in infrastructure to a domain error, for example `DuplicateWord` or `QuestionAlreadyAnswered`.

## Delete semantics

Each delete is one use case running in **one transaction**. Each step is an explicit statement; nothing is implicit in the database.

| Use case | Steps (`now` = `Clock`) |
|---|---|
| `deleteWord(wordId)` | 1. `UPDATE words SET deleted_at = now`<br>2. `UPDATE cards SET deleted_at = now WHERE word_id = $1` (all drills)<br>3. If the Learner's active session has a pending question for this word, abandon that session |
| `deleteDeck(deckId)` | 1. `UPDATE decks SET deleted_at = now, visibility = 'private', published_at = NULL` (it disappears from Community)<br>2. `UPDATE words … WHERE deck_id = $1 AND deleted_at IS NULL`<br>3. `UPDATE cards … WHERE word_id IN (those words)`<br>4. Abandon any active session scoped to the deck, or one with pending questions from it |
| `deleteLearner` (not in the MVP API) | Revoke all refresh tokens, soft-delete their decks (as above), then set `learners.deleted_at` |

- **Logs stay intact.** `reviews` and `session_questions` are never touched. Analytics queries join `words` and filter `deleted_at IS NULL`, so history for deleted words simply stops showing.
- **Forks:** `forked_from_id` keeps pointing at a deleted source deck, and the UI shows "forked from a deleted deck". Forked copies are unaffected.
- **No restore.** There is no UI for it (YAGNI). `deleted_at` exists for history integrity and accidental-delete recovery by an admin, who runs `UPDATE … SET deleted_at = NULL` in one transaction across the same rows.
- **Hard purge:** soft-deleted rows are kept forever for now. `ponytail:` add a purge job (and an account-deletion path for privacy requests) when storage or privacy law requires it. Expired `refresh_tokens` are still hard-deleted: they are security material with no history value and no dependants.

## Notes

- **Card is separate from Word** (1:N, one per drill, created lazily). Words are Library content and Cards are Study state. `cards.deleted_at` duplicates `words.deleted_at` on purpose, so the hottest index (`learner_id, drill, due`) excludes deleted rows without a join.
- **New words in a drill** are selected with an anti-join: `words w WHERE w.deck_id = $1 AND w.deleted_at IS NULL AND <applicability(drill)> AND NOT EXISTS (SELECT 1 FROM cards c WHERE c.word_id = w.id AND c.drill = $d AND c.deleted_at IS NULL) ORDER BY w.created_at LIMIT $n`. The `cards_word_drill` index makes the `NOT EXISTS` an index probe. The applicability fragment is generated from the drill definition ([14](14-drills.md)).
- **`learner_id` is denormalized on `cards` and `reviews`.** It never changes, because deck ownership cannot be transferred.
- **Two logs:** `reviews` holds first attempts and drives FSRS. `session_questions` holds every attempt and drives "confused with" and attempts-to-correct.
- **A fork is one transaction:** insert the deck, insert words from `unnest($slugs)` joined with the live source words (`deleted_at IS NULL`, `ORDER BY id`), then `UPDATE decks SET fork_count = fork_count + 1` on the source.
