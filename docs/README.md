# Voca

Voca is a web app for learning vocabulary with spaced repetition. You build decks of words, study them in short multiple-choice sessions, and Voca schedules each word so it comes back just before you would forget it.

It works with any language, including ones with their own scripts. Japanese words are drilled with their hiragana reading, Chinese words with pinyin.

> **Status:** in design. No code has been written yet.

## Features

- **Spaced repetition** with FSRS-6, the algorithm Anki now uses by default.
- **Decks** to group words, with batch import from CSV files up to 5 MB.
- **Drills:** Word → Meaning, Meaning → Word, Word → Reading, and Reading → Word. Pick one or more before a session, and the session can mix them. Each drill is scheduled separately.
- **Sessions** of 7, 10, 15 or 20 words. A wrong answer comes back until you get it right.
- **Hard mode:** the wrong options are words that look or sound like the right one.
- **Hard words:** a separate place for the words you struggle with.
- **Per-word stats:** recall probability, accuracy, streak, answer time, and which words you confuse it with.
- **Notifications** for decks and words that are due.
- **Community decks:** share a deck publicly, or copy someone else's.
- **Time zones:** words fall due at the start of your own study day, wherever you are.
- **Sound effects** for correct and wrong answers, with a mute toggle.
- **Google sign-in.**

## Tech stack

| Part | Technology |
|---|---|
| Runtime, package manager, tests | Bun (workspaces) |
| Language | TypeScript, Effect |
| Backend | Effect `HttpApi`, `@effect/sql-pg` |
| Database | PostgreSQL |
| Frontend | React 19, TanStack Router and Query, Vite |
| Auth | Google OAuth (code + PKCE), JWT access tokens, rotating refresh tokens. No cookies |
| Hosting | Cloudflare Pages (frontend), Kubernetes cluster `kube-oci` (backend and Postgres) |

## Repository layout

```
voca/
  contract/   API contract shared by the backend and frontend
  be/         backend: domain, application, infrastructure layers
  fe/         frontend
  docs/       design docs
```

## Development

Planned commands, once the code exists:

```sh
bun install
podman compose up -d postgres   # local database
bun test                        # backend and contract tests
bun run typecheck
```

## Documentation

The design docs are in this folder, starting with the [functional requirements](01-functional-requirements.md). The UI is defined in the [design system](design-system.html).
