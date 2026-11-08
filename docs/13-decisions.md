# 13 — Decisions & Open Questions

## ADR log

| # | Decision | Alternatives | Why |
|---|---|---|---|
| 1 | FSRS-6 in our own code (~150 lines) | SM-2; `ts-fsrs` dependency | Better scheduling; a pure core domain; no dependency. `ts-fsrs` is used once to generate test vectors |
| 2 | Two Card states (`new`, `review`); in-session retries are not fed to FSRS | Anki learning steps; FSRS same-day formula (w17–w19) on retries | Rating only the first attempt counts one forgetting event once. Retries stay in `session_questions` for analytics |
| 3 | Ratings derived from correctness and latency; `Easy` never auto-assigned | Learner self-grading | Fits the multiple-choice UX. Avoids inflating stability through recognition |
| 4 | Due dates fall on study-day boundaries (local `dayStartHour`) | Exact `now + interval` | Matches how learners think ("due tomorrow"); DST-safe via Effect `DateTime` |
| 5 | Forking copies a deck | Subscribing by reference | No cross-user coupling. Owner edits and deletes can't break other Learners' study history |
| 6 | Hard mode: on-the-fly grapheme and reading Levenshtein | Precomputed neighbor table; embeddings | No table, no job, language-generic. The upgrade path is documented |
| 7 | Synchronous, atomic CSV import | beanstalkd worker | 5 MB takes about 1 s; a queue would add infrastructure and an unmaintained client |
| 8 | JWT HS256 (`jose`) + rotating opaque refresh tokens | PASETO v4 | JS PASETO libraries see little maintenance; the algorithm is pinned; there is one service |
| 9 | React + TanStack + Vite | Foldkit | Foldkit is pre-1.0 with breaking minor releases |
| 10 | A shared `HttpApi` contract package | OpenAPI codegen; hand-written fetch | One source of truth and end-to-end Schema validation with no code generation |
| 11 | Notifications computed on request | Stored notification table; push | Nothing to keep in sync; one indexed query |
| 12 | Hard Words is a flag on the Card | A system Deck | A Word stays in its Deck; no copies to keep in sync |
| 13 | A plain-YAML deploy with migrations at boot | Helm; a migration Job | 6 files and 1 replica. Recreate strategy for the MVP |
| 14 | `bigint` primary keys internally; external **slug** = random uppercase Crockford base32, length per model (Learner 8, Deck 10, Word 12, Session 14), no prefix | Prefixed ULID; UUID primary keys; Sqids/hashids derived from the bigint | Short, readable URLs. Fully random, so it reveals neither creation time nor row counts. Distinct lengths keep types apart at the boundary. The unique index handles collisions with one retry |
| 15 | FR-13 revised: picked once, wrong answers retried until correct; the client orders retries 3 questions later | A server-ordered queue; showing each word only once | The server enforces invariants (one pending question per word, nothing after a word is cleared), while ordering is presentation only |
| 16 | Sounds synthesized with the Web Audio API; mute setting in `localStorage` | Audio files; a server-side setting | No files, no dependency. Muting is a per-device preference |
| 17 | Soft delete (`deleted_at`) with explicit cascade steps in the use case; no `ON DELETE CASCADE` | Database cascades | History is preserved, deletes are visible in code, and recovery is possible. Partial indexes keep reads cheap |
| 18 | All invariants live in Schemas and domain functions; no `CHECK`s or database defaults. **`UNIQUE`, `NOT NULL`, and foreign keys are kept** | Database `CHECK`s | One source of truth in code, re-validated when rows are read. Unique indexes stay because code cannot prevent duplicates from concurrent requests without locks |
| 19 | UI design system: **Washi Minimal** ([design-system.html](design-system.html)). On hover, only a button's background changes: filled buttons fade to 60% opacity, and outlined buttons get a faint tint of their own color (ink 8%, danger 10%); text, borders and all other components are unchanged. There is no press or translate animation | Brutalist, Gazette Editorial, Phosphor Terminal (explored, then removed) | Quiet and spacious, and its Mincho serif suits CJK terms. Light theme only in the MVP |
| 20 | Drills: 4 fixed directions (`term_meaning`, `meaning_term`, `term_reading`, `reading_term`), one or more picked before each session (mixed sessions; a word appears in one drill per session); one lazily created Card per (word, drill) | A romanization field with romaji drills and derived katakana; one Card per word | Native scripts only: `reading` is hiragana for ja (kanji and katakana terms alike) and pinyin for zh. Each direction is a separate skill, so it has its own FSRS memory. Lazy cards mean no rows for unused drills and no backfill |

## Open questions for you

1. **beanstalkd:** OK to drop it from the MVP, per ADR 7? Or is it a hard requirement, for example because you want it in place for future workloads?
2. **API hostname:** reuse `vocaapi.arvinpaundra.dev`, or use a new host? What is the domain for the Cloudflare Pages frontend?
3. **Cluster cleanup:** OK to run the cleanup in [12](12-deployment.md)? Do you want it done now, which takes the old API offline, or at cutover? Should the old database be backed up before it is dropped?
4. **Google OAuth client:** reuse the existing client ID and secret from `voca-api-secret`, or create a new one?
5. **Cluster Postgres version:** I couldn't query it because of permissions. Please confirm it is 13 or later. Slugs are generated in the app, so no newer feature is needed.
6. **Question direction:** the MVP asks term → meaning only. Is that enough, or do you also need meaning → term from day one?
