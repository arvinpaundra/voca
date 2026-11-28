# Voca

Voca is a web app for learning vocabulary with spaced repetition. You build decks of words, study them in short multiple-choice sessions, and Voca schedules each word so it comes back just before you would forget it.

It works with any language, including ones with their own scripts. Japanese words are drilled with their hiragana reading, Chinese words with pinyin.

## Features

**Studying**
- **Spaced repetition** with FSRS-6, the algorithm Anki now uses by default.
- **Drills:** Word → Meaning, Meaning → Word, Word → Reading, and Reading → Word. Pick one or more before a session. Each drill is scheduled separately.
- **Sessions** of 7, 10, 15 or 20 words. A wrong answer comes back until you get it right, and a session survives a page reload.
- **Hard mode:** the wrong options are words that look or sound like the right one.
- **Flashcards:** flip through a deck with no grading.
- **Daily new-card target:** a goal to track, not a cap that blocks new words.
- **Sound effects** for correct and wrong answers, with a mute toggle.

**Decks and words**
- **Decks** to group words. Add several words at once, or import CSV files (up to 5 MB each, several decks in one go) and match your own column names to Voca's fields.
- **Hard words:** a separate place for the words you struggle with, filled in by hand or suggested when a word keeps failing.
- **Deck snooze:** set decks aside so their due counts stop piling up.
- **Community decks:** share a deck publicly, or copy someone else's.
- **Word font:** pick a typeface for CJK characters.
- **Paged lists** for large deck and word collections.

**Progress**
- **Dashboard** with what's due today.
- **Activity heatmap:** a calendar of how much you studied each day.
- **Per-word stats:** recall probability, accuracy, streak, answer time, and which words you confuse it with.
- **Notifications** for decks and words that are due.

**Account**
- **Google sign-in.**
- **Time zones:** words fall due at the start of your own study day, wherever you are.
- **Delete account:** removes your identity; copies other Learners hold stay theirs.
- Works on phone-width screens, and shared links show a preview card.

## Tech stack

| Part | Technology |
|---|---|
| Runtime, package manager, tests | Bun (workspaces) |
| Language | TypeScript, Effect 4 |
| Backend | Effect `HttpApi`, `@effect/sql-pg`, beanstalkd for batch imports |
| Database | PostgreSQL 18 |
| Frontend | React 19, TanStack Router and Query, Vite |
| Auth | Google OAuth (code + PKCE), JWT access tokens, rotating refresh tokens. No cookies |
| Hosting | Cloudflare Pages for the frontend; a Pages Function proxies `/api` to a Kubernetes cluster (API pod + PostgreSQL) |

## Repository layout

```
voca/
  contract/   HTTP API and Schemas shared by the backend and frontend
  be/         backend, one folder per bounded context (identity, library, study, insight),
              each layered domain / application / infrastructure / http
  fe/         frontend SPA and the Cloudflare Pages Function
  deploy/k8s/ Kubernetes manifests
  scripts/    verify gate and the agent dispatch loop
  lint/       ast-grep rules
  docs/       specs and ADRs
```

## Development

Prerequisites: Bun, Podman (or Docker) for the test database, and a Google OAuth client.

```sh
bun install

# be/.env: DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
#          (optional: PORT=8000, BEANSTALKD_HOST/PORT for batch imports)
# fe/.env: VITE_GOOGLE_CLIENT_ID   (see fe/.env.example)

bun run dev:be      # runs migrations, then the API on :8000
bun run dev:fe      # Vite on :5173, proxies /api to :8000
```

Checks:

```sh
podman machine start   # macOS, once per boot; tests start Postgres via Testcontainers
bun run verify         # the gate: path guard, lint, typecheck, tests, fe build
bun run lint           # ast-grep rules (no comments, no throw/async in be/)
bun run typecheck
bun test               # inside be/, fe/ or contract/
```

## Deployment

`.github/workflows/release.yml` builds the arm64 API image, applies `deploy/k8s/`, and deploys `fe/dist` to Cloudflare Pages. See [docs/12-deployment.md](docs/12-deployment.md).

## Documentation

Specs are in [`docs/`](docs/), starting with the [functional requirements](docs/01-functional-requirements.md). Decisions are logged in [docs/13-decisions.md](docs/13-decisions.md). Contributor and agent rules are in [AGENTS.md](AGENTS.md).
