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
| 7 | Synchronous, atomic CSV import. **beanstalkd dropped** (confirmed); revisit at scale | beanstalkd worker | 5 MB takes about 1 s; a queue would add infrastructure and an unmaintained client. At scale, start with a Postgres `SKIP LOCKED` queue, then beanstalkd ([09](09-csv-import.md)) |
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
| 21 | One origin, `https://voca.arvinpaundra.dev`: the SPA on Cloudflare Pages, the API under `/api/*`, proxied by a Pages Function to `voca-origin.arvinpaundra.dev` in kube-oci. The contract prefixes every route with `/api` | Separate API host with CORS; serving the SPA from the cluster; a Cloudflare Origin Rule | No CORS, `connect-src 'self'`, and the same paths in local dev (Vite proxy) and production. Ceiling: every API call is a Worker request, free up to 100k/day (about 2,500 daily learners), then Workers Paid at $5/month |
| 22 | PostgreSQL **18.3** (the existing cluster instance) | — | Confirmed. The schema needs only 13 or later, so no 18-only feature is relied on |
| 23 | **Effect 4.1.2**, pinned exactly, with TypeScript 7 | Effect 3.x (now `prev`) with `@effect/platform` | v4 is the LTS line and folds http-api, sql and multipart into `effect`. Its http-api and sql modules are marked unstable, hence the exact pin |
| 24 | Request validation failures return Effect's built-in empty `400` | A custom `ValidationError` body | The frontend decodes with the same contract Schemas first, so the server's 400 only signals a client bug. CSV row errors stay a typed `ImportRejected` |
| 25 | Marking an unstudied (word, drill) as hard returns `404` | Creating a blank Card | Cards stay lazy: one exists only after a first answer. The UI hides the button |
| 26 | Integration tests start Postgres with **Testcontainers**: Podman by default, Docker as the fallback | `podman compose` started by hand; an in-memory database | `bun test` needs no setup step, uses the production image (`postgres:18.3-alpine`), and cleans up after itself. Works on either runtime through `DOCKER_HOST` |

## Open questions for you

Resolved on 2026-11-08: beanstalkd is dropped (ADR 7), the domain and `/api` routing are set (ADR 21), Postgres is 18.3 (ADR 22), and meaning → term is in the MVP through drills (ADR 20, all 4 drills).

1. **Cluster cleanup (deferred):** the project is a local PoC, so nothing in kube-oci is touched. Before the first real deploy, the old `voca` namespace has to go (the new deploy reuses that name) and the old database needs a backup decision. See [12](12-deployment.md).
2. **Google OAuth client (pending, you'll provide it):** a client ID and secret with the redirect URIs `https://voca.arvinpaundra.dev/auth/callback` and `http://localhost:5173/auth/callback`. Local development can start with a stubbed `GoogleOAuth` layer until then.
