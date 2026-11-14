# 11 — Testing

Tooling:
- **`bun test`** is the runner.
- **`effect/Arbitrary`** provides property tests (Effect 4 has its own generator and runner, `Arbitrary.schema` + `Arbitrary.checkEffect`; FastCheck is gone), so there is no extra dependency.
- A **real Postgres** is started by **Testcontainers** (`testcontainers` 12.x, a `be` dev dependency), using the same image as production: `postgres:18.3-alpine`. Container runtime: **Podman by default, Docker as the fallback** (below).

There are no mocks for the database. In-memory layers are used only for Google, so tests never call the network.

## Layout

```
be/bunfig.toml        # [test] preload = ["./test/preload.ts"]
be/test/
  runtime.ts          # picks Podman, else Docker, for Testcontainers; turns Ryuk off
  preload.ts          # once per run: start the Postgres container, migrate a template database, export TEST_PG_ADMIN_URL, stop it after the run
  setup.ts            # makeTestDb(): per file, copies the template into database voca_test_<n>, drops it on release; resetDb
  layers.ts           # TestLayer = Db(real) (+ GoogleStub + TestClock + seeded Random as those contexts arrive)
  db.test.ts          # smoke test of the above
  fixtures/fsrs-golden.json
  scheduling.test.ts  study-session.test.ts  timezone.test.ts
  analytics.test.ts   import.test.ts          auth.test.ts   community.test.ts
be/src/**/domain/*.test.ts   # pure unit + property tests next to the code
```

### Container runtime: Podman first, Docker fallback

Testcontainers talks to any Docker-compatible API through `DOCKER_HOST`. `test/runtime.ts` runs before Testcontainers is imported and sets it:

1. **`DOCKER_HOST` already set** → used as is (explicit override, e.g. in CI).
2. **Podman available** → `DOCKER_HOST` = the Podman socket, from `podman machine inspect --format '{{.ConnectionInfo.PodmanSocket.Path}}'` on macOS, or `$XDG_RUNTIME_DIR/podman/podman.sock` on Linux.
3. **Otherwise** → nothing is set and Testcontainers finds Docker by itself.

If neither runtime answers, the run fails at preload with one message naming both, instead of every suite timing out.

- **macOS:** `podman machine start` must have run first.
- **Two Bun workarounds** (the same ones the `bean` repo uses; Bun 1.3.10):
  - **Ryuk is off** (`TESTCONTAINERS_RYUK_DISABLED=true`). Its startup check waits on a container log stream that never completes under Bun. The container is stopped in an `afterAll`. A killed run leaves its container behind, so each one carries a `voca-test=<pid>` label and `preload.ts` removes those whose owner process is gone.
  - **A custom wait strategy** replaces the log-based default, which hangs for the same reason. It polls `SELECT 1` over TCP. `pg_isready` and an open port are not enough: Postgres's image runs a temporary server during `initdb`, and Podman's port forwarding accepts connections before the final server listens.
- **Speed:** the container takes about 5–7 s to be ready, once per run. Preload migrates one template database (`voca_template`), then each file copies it (`CREATE DATABASE … TEMPLATE`), which is fast. The slow work sits in preload, outside the per-test timeout: after the Mac has idled, the Podman VM's first round trips can be slow, and when the per-file migration ran inside the first test that occasionally hit the 30 s timeout in `bunfig.toml`.
- `preload.ts` uses top-level `await`, which `lint/functional.yml` exempts for that one file.

Isolation:
- One Postgres container per `bun test` run, shared by all files.
- Each test file gets a fresh, migrated database inside it, copied from the template (`makeTestDb()`), dropped when the file's runtime is disposed.
- Each test starts from empty tables: `beforeEach(() => rt.runPromise(resetDb))` runs `TRUNCATE … RESTART IDENTITY CASCADE`. A transaction rolled back per test was the first plan, but HTTP-level tests call handlers on their own fibers, outside a test-level transaction, so it would not cover them.
- Files run one after another, each against its own database.

## Correctness suites (the "integration tests for correctness metrics")

### 1. Scheduling: FSRS correctness
- **Golden vectors:** 200 rating sequences generated once with `ts-fsrs` (FSRS-6 defaults, `enable_short_term: false`, fuzz off) and stored in `fsrs-golden.json`. The domain `schedule` must match `stability`, `difficulty`, and interval within `1e-4`.
- **Properties** (`Arbitrary`, 1,000 runs each):
  - `difficulty ∈ [1, 10]` and `stability > 0`, always
  - success never decreases stability, and a lapse never increases it
  - `R(S, S) = 0.9 ± 1e-9`, and `R` is monotonically decreasing in `t`
  - `interval ≥ 1` and `≤ maxInterval`
  - with `r = 0.9`, the interval is approximately `S`

### 2. Study session invariants (FR-11, FR-12, FR-13), through HTTP
- For a deck with 30 due words and size 7, 10, 15, or 20: the session has exactly that many attempt-1 questions, and their word IDs are distinct.
- Each question has 4 distinct options, exactly one of which is the prompt word, and no two options share a `meaningKey`.
- **Retry until correct:**
  - A wrong answer → the response includes a `retry` with `attempt + 1`, the same word, and new options.
  - A correct answer → `retry: null`, and no further question for that word is ever created.
  - Wrong ×3 then correct → 4 rows for the word, but exactly **1** `reviews` row, and the card's `due`, `stability`, and `difficulty` equal the result of the first (wrong) attempt.
  - The session becomes `completed` only after every word is cleared.
  - Inserting a second pending question for the same word directly in the database violates `one_pending_per_word`.
- **Property test** (`Arbitrary`): for a random answer script, the session ends with exactly `size` cleared words, retries ≥ wrong answers, and reviews = `size`.
- Answering the same position twice → `409`. Concurrent answers to the same position are run with `Effect.all({concurrency: 2})`: exactly one succeeds.
- A wrong first attempt makes the card due on or after the next study-day start.
- Starting a second session abandons the first one, and the unanswered words of the first stay due.
- When the daily new-word limit is reached, the session is filled only with due words and is shorter.
- **Hard mode:** in a fixture deck containing `生活, 生命, 生物, 食べる, 飲む, 橋(はし), 箸(はし)`, asking about `箸` always includes `橋` among the options, and asking about `生活` includes at least 2 of `生命` / `生物` (the seed is fixed).
- `DeckTooSmall` for a deck with 3 words.

### 2b. Drills (FR-16, FR-17)
- **Applicability:**
  - 食べる/たべる and コーヒー/こーひー → all 4 drills apply.
  - ありがとう (no reading) → only `term_meaning` and `meaning_term` apply.
  - 学习/xuéxí → all 4 drills apply.
- `/decks/:id/drills` lists only drills that apply to at least one word, with correct due and new counts.
- **Independent scheduling:** answering 食べる in `term_reading` creates a card for `(食べる, term_reading)` only. The `term_meaning` card is untouched, and the word is still new in `term_meaning`.
- **Shared new limit:** with `newPerDay = 5`, 3 new words in one drill and 2 in another exhaust the limit.
- **Answer dedupe:** in `term_reading`, 箸 and 橋 (both はし) never appear as options for each other. In `zh term_reading`, `shì` and `shí` can both be options.
- **Hard mode:** a fixture deck answered in `term_reading` for 是 includes at least 2 of `shí` / `sì` (tone-stripped similarity, fixed seed).
- **Mixed sessions** (drills = all 4, size 10):
  - The questions cover more than one drill.
  - No word appears in two drills.
  - A word with due cards in 2 drills is picked once, in its most overdue drill.
  - New words are filled round-robin across drills.
  - A retry keeps its drill.
  - The review and card written for each answer use the question's drill.
- **Errors:** `DrillNotAvailable` when none of the selected drills applies to any word in the scope. Soft-deleting a word soft-deletes its cards in every drill.

### 3. Timezone & due boundaries (FR-9)
The test matrix uses `TestClock` with these timezones: `UTC`, `Asia/Jakarta`, `Asia/Tokyo`, `America/New_York`, `Asia/Kathmandu` (+5:45), and `Pacific/Chatham` (+12:45).
- A word answered at 23:50 local time with a 1-day interval is due at the next day's `dayStartHour`, not 24 h later.
- Answering at 03:59 with `dayStartHour = 4` counts toward the *previous* study day.
- The New York DST weeks (spring-forward and fall-back), with `dayStartHour ∈ {2, 4}`: the study day lasts 23 h or 25 h, and due instants land on the boundary.
- After the timezone changes, existing `due` instants are unchanged, and the notifications use the new day bounds.

### 4. Analytics metrics correctness
Seed a known review history by inserting `reviews` rows directly with hand-computed expectations, then call `/words/:id/stats` and `/decks/:id/stats`. Assert:
- Accuracy (overall, last 10, per mode), streak, and median latency, all from first attempts only
- `confusedWith` order and counts (retries included), and `attemptsToCorrect`
- maturity transition at S = 21 days
- `recallNow` against the formula at the clock time
- true retention excludes first reviews of new cards
- forecast buckets in the Learner's timezone
- notifications: due and overdue counts, and the new-word limit

### 4a. Activity heatmap (FR-18)
- Reviews seeded across several months → `/me/activity?month=2026-10` returns one entry per active day in October with the right count, and nothing from September or November.
- No `month` → the current study month. With `Asia/Tokyo` and `dayStartHour = 4`, at 03:30 local on 1 Dec the current month is still November.
- A review at 03:30 local on 1 Dec counts for 30 Nov and appears in November's response.
- A future month → `200` with `days: []`. `month=2026-13` or `2026-1` → `400`.
- Retries are not counted: wrong ×3 then correct is 1 review on that day.
- A review on the New York DST change days lands on the right date.
- Deleting a deck does not remove its days.

### 4b. Slugs
- **Unit:**
  - `slug(n)` always returns `n` characters, all from the Crockford alphabet, all uppercase.
  - With a seeded Random it is deterministic.
  - Across 1M draws, every character appears with roughly the same frequency (no modulo bias).
- **Collision:** a stubbed Random first returns an existing slug, then a fresh one. The insert succeeds after one retry, and two collisions in a row are reported as a defect.
- **HTTP:**
  - Every response body is scanned recursively, and no numeric `id` field may appear. Every slug field matches `^[0-9A-HJKMNP-TV-Z]{8,14}$`, with the length expected for its model.
  - A word slug (12 characters) sent to `/decks/:deckSlug` → `400`.
  - A lowercase deck slug resolves to the same deck.
  - A well-formed but unknown slug → `404`.

### 4c. Invariants in code & soft delete
The database has no `CHECK`s, so these tests are the only guard:
- **Every domain Schema:** valid and invalid values (tables, plus `Arbitrary.schema` for valid ones). Invalid ones are rejected at decode time with the correct field path. Examples: session size 8, retention 0.97, a 121-character title, a `review` card with null stability.
- **Row decoding:** a hand-corrupted row (for example `state = 'review'` with `due = NULL`, inserted directly) causes a decode failure when read. It is never served.
- **Delete a deck:**
  - In one transaction, the deck, its words, and its cards get `deleted_at`, and a matching active session is abandoned.
  - The deck disappears from `/decks`, `/community/decks`, `/notifications`, `/hard-words`, and the session pools.
  - The `reviews` and `session_questions` rows still exist.
  - Forking a deleted public deck → `404`.
- **Delete a word, then re-add the same term** → succeeds (partial unique index). Importing the same term after a delete → the term is imported, not skipped.
- **No physical deletes:** a test asserts that row counts in `decks`, `words`, and `cards` never decrease across the whole suite. `refresh_tokens` is excluded.

### 5. Import
- RFC 4180 edge cases are unit-tested in the parser: quotes, an escaped `""`, embedded newlines, CRLF, a BOM, a trailing newline, and an empty optional column.
- 5 MB + 1 byte → `413`. Invalid UTF-8 → `422`. An unknown column → `422`.
- With 1 bad row out of 1,000, zero rows are written and the error is reported with its row number.
- Duplicates within the file and against the deck are skipped and counted. `ｶﾀｶﾅ` and `カタカナ` count as duplicates.
- A 20k-row file imports in under 3 s in CI. This is an assertion, so performance regressions are caught.

### 6. Auth
- Google is stubbed through a `GoogleOAuth` layer.
- First sign-in creates the Learner, and a second sign-in reuses it.
- A refresh rotates the token. Reusing an old refresh token revokes the whole family, and the newer token then fails too.
- Expired, tampered, or `alg: none` access tokens return `401`.
- A request with another Learner's deck ID returns `404`.

## Commands

```
podman machine start          # macOS, once per boot; Linux needs nothing
bun test                      # root: runs be + contract tests; Testcontainers starts Postgres itself
bun test be/test/timezone     # one suite
DOCKER_HOST=unix:///var/run/docker.sock bun test   # force Docker
bun run typecheck             # tsc across workspaces
```

The frontend tests only its pure logic in `fe/src/lib` (PKCE, the token store). Everything else lives in the shared contract and on the server, so there are no component tests in the MVP. Add Playwright for the study flow if regressions appear.
