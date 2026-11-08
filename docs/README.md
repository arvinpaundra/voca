# Voca — Design Docs

Voca is a web app for learning vocabulary with spaced repetition. It works with any language, including ones with their own scripts such as Japanese and Chinese. Users study in short multiple-choice sessions, share decks with the community, and can see per-word progress.

Status: **draft, waiting for approval.** No code has been written yet.

| # | Doc | What it covers |
|---|-----|----------------|
| 01 | [Functional requirements](01-functional-requirements.md) | MVP scope, user stories, acceptance criteria, and what is out of scope |
| 02 | [Domain model](02-domain-model.md) | Ubiquitous language, bounded contexts, aggregates, invariants |
| 03 | [Architecture](03-architecture.md) | Monorepo layout, layers, Effect conventions, dependency budget |
| 04 | [Scheduling (FSRS) & time](04-scheduling.md) | Spaced repetition algorithm, how answers become ratings, timezone handling |
| 05 | [Study sessions, hard mode & sound](05-study-sessions.md) | How sessions are built, retry-until-correct, distractors, similarity scoring, Web Audio sound effects |
| 06 | [Data model](06-data-model.md) | Postgres schema, indexes, constraints |
| 07 | [API](07-api.md) | HTTP contract |
| 08 | [Auth](08-auth.md) | Google OAuth, access tokens, refresh-token rotation |
| 09 | [CSV import](09-csv-import.md) | File format, limits, validation, and whether to use beanstalkd |
| 10 | [Analytics & notifications](10-analytics.md) | Per-word metrics (with research notes), deck stats, notification panel |
| 11 | [Testing](11-testing.md) | Integration tests for correctness |
| 12 | [Deployment](12-deployment.md) | Cloudflare Pages, kube-oci, Postgres, cleanup of the old Voca deployment |
| 13 | [Decisions & open questions](13-decisions.md) | ADR log and items you need to decide |
| 14 | [Drills](14-drills.md) | Question directions picked before each session; reading per language (hiragana, pinyin) |
| — | [Design system](design-system.html) | Washi Minimal: tokens, components, screens |

## Decisions at a glance

- **Spaced repetition:** FSRS-6 instead of SM-2. It needs fewer reviews for the same retention, and Anki now uses it by default.
- **Frontend:** React 19, TanStack Router, TanStack Query, and Vite. Foldkit is still pre-1.0 (v0.x, with breaking minor releases), so it is not used.
- **Shared API contract:** one `@effect/platform` `HttpApi` definition is shared by the backend and frontend, so types are checked end to end.
- **Auth:** Google OAuth (authorization code + PKCE). The API issues short-lived JWT access tokens and rotating opaque refresh tokens. Tokens are sent in the `Authorization` header; no cookies are used.
- **Community decks are forked (copied)**, not shared by reference, so there is no coupling between users.
- **beanstalkd is dropped from the MVP.** Importing a 5 MB CSV synchronously takes about one second. See [09](09-csv-import.md).
- **IDs:** `bigint` keys internally. Outside the server, everything uses **slugs**: random uppercase strings with a length per model (Learner 8, Deck 10, Word 12, Session 14).
- **Wrong answers are retried until correct** within the session. Only the first attempt affects scheduling.
- **Sound effects** are synthesized with the Web Audio API, with a mute toggle.
- **Drills:** before each session, pick one or more of Word → Meaning, Meaning → Word, Word → Reading, and Reading → Word. Sessions can mix them. Readings use the language's own system (hiragana, pinyin). Each (word, drill) is scheduled separately.
- **Hard mode is kept in the MVP.** Similar words are scored on the fly when a session is created, with no precomputed table. See [05](05-study-sessions.md).
