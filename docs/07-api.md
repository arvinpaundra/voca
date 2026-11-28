# 07 — HTTP API

The API is defined once in `contract/` (`VocaApi` in `contract/src/api.ts`) as an Effect 4 `HttpApi` from `effect/http-api`:
- The backend implements it with `HttpApiBuilder`.
- The frontend consumes it through `HttpApiClient.make(VocaApi)`.
- `HttpApiSwagger` serves OpenAPI at `/docs` outside production.

Conventions:
- **Base path:** every route below lives under `/api` on the same origin as the SPA, for example `GET https://voca.arvinpaundra.xyz/api/decks`. The prefix is set once in the contract (`HttpApi.prefix("/api")`), so the backend, the Pages Function proxy, and the Vite dev proxy all pass paths through unchanged.
- **Slugs:** every `:deckSlug`, `:wordSlug`, and `:sessionSlug` path parameter and every `*Slug` field is a slug: random uppercase Crockford base32 with no prefix. Lengths: learner 8, deck 10, word 12, session 14. Internal `bigint` IDs never appear. Lowercase input is accepted and uppercased. A slug of the wrong length or with a character outside the alphabet → `400`.
- JSON bodies.
- `Authorization: Bearer <access>` on every route except `/api/auth/*` and `/api/healthz`.
- Errors are `{ _tag, message }`. The `_tag` values are listed below.
- Lists use keyset pagination with `?cursor=…&limit=…` (default 50, max 200) and return `{ items, nextCursor | null }`.

## Identity

| Method | Path | Body → Response |
|---|---|---|
| POST | `/auth/google` | `{code, codeVerifier, redirectUri, timezone}` → `{accessToken, refreshToken, expiresIn, learner}` |
| POST | `/auth/refresh` | `{refreshToken}` → `{accessToken, refreshToken, expiresIn}` |
| POST | `/auth/logout` | `{refreshToken}` → `204` |
| GET | `/me` | → `Learner` (profile + settings) |
| PATCH | `/me/settings` | `{timezone?, dayStartHour?, desiredRetention?, newPerDay?, defaultSessionSize?, defaultMode?}` → `Learner` |
| DELETE | `/me` | → `204`. Deletes the account (FR-37, ADR 73): its decks, its tokens, and the name, email, photo and Google link |

On `/auth/google`, `timezone` is used only when the account is created.

## Library

| Method | Path | Body → Response |
|---|---|---|
| GET | `/decks` | `?q&termLang&sort=recent\|title\|words\|due&cursor&limit` → `Page<DeckSummary> & {total, termLangs}` (own decks, with `wordCount` and `dueCount`). No `sort`: newest created first. `recent` = last edited first, `title` A–Z, `words` and `due` biggest first, ties by title. `q` matches the title, `termLang` is an exact tag. `total` and `termLangs` (sorted, distinct) describe the whole library, whatever the query (FR-31) |
| POST | `/decks` | `{title, description?, termLang, meaningLang}` → `Deck` |
| GET | `/decks/:deckSlug` | → `Deck & {wordCount, dueCount}` |
| GET | `/decks/:deckSlug/drills` | → `[{drill, label, due, new}]`: only drills that apply to at least one word (FR-17); `new` counts the deck's words with no Card in that drill, whatever the daily target (FR-36) |
| GET | `/decks/:deckSlug/setup` | → `{drills: [{drill, label, due, new}], newCards: {studied, target}}`: the study setup screen in one request. `drills` is the `/drills` list; `studied` counts today's first reviews (`state_before = 'new'`) in every deck, snoozed ones included, and `target` is the Learner's `newPerDay` (FR-36) |
| PATCH | `/decks/:deckSlug` | `{title?, description?, termLang?, meaningLang?}` → `Deck` |
| DELETE | `/decks/:deckSlug` | → `204` |
| POST | `/decks/:deckSlug/publish` | → `Deck` |
| POST | `/decks/:deckSlug/unpublish` | → `Deck` |
| POST | `/decks/snooze` | `{deckSlugs: DeckSlug[1..200], days: 1\|3\|7\|14\|null}` → `Deck[]`: all or nothing; `null` = until unsnoozed (FR-20) |
| POST | `/decks/unsnooze` | `{deckSlugs: DeckSlug[1..200]}` → `Deck[]` |
| POST | `/decks/delete` | `{deckSlugs: DeckSlug[1..200]}` → `{failed: DeckSlug[]}`: each deck deleted as `DELETE /decks/:deckSlug` does; the ones missing, already deleted or not the Learner's are listed, the rest are gone (FR-28) |
| GET | `/decks/:deckSlug/flashcards` | `?size=7\|10\|15\|20` (absent: all) → `Word[]` in a fresh random order; reads only (FR-21) |
| GET | `/decks/:deckSlug/words` | `?q&cursor&limit` → `Page<WordWithCard>` |
| POST | `/decks/:deckSlug/words` | `{term, meaning, reading?, example?, notes?}` → `Word` |
| POST | `/decks/:deckSlug/words/batch` | `{words: CreateWord[1..50]}` → `Word[]` in request order; all or nothing (FR-26) |
| PATCH | `/words/:wordSlug` | partial Word → `Word` |
| DELETE | `/words/:wordSlug` | → `204` |
| POST | `/decks/:deckSlug/import` | `multipart/form-data` field `file` (≤ 5 MB) and optional `columns` (JSON `ColumnMatch`, ADR 70) → `{imported, skippedDuplicates}` |
| GET | `/decks/:deckSlug/export` | → `text/csv` |

### Imports (FR-29)

| Method | Path | Body → Response |
|---|---|---|
| POST | `/imports` | `multipart/form-data`: `termLang`, `meaningLang`, `files` (1–50, each ≤ 5 MB, ≤ 50 MB in all), optional `columns` (JSON, one `ColumnMatch` per file in file order, ADR 70) → `ImportBatch`; more than 50 files → `400`, over 50 MB in all → `413`, nothing stored |
| GET | `/imports` | → `ImportBatch[]`: not dismissed, newest first |
| DELETE | `/imports/:batchSlug` | → `204`; `409 ImportRunning` while a file is pending or running |
| POST | `/imports/events/ticket` | → `{ticket}`: single use, valid 30 s |
| GET | `/imports/events` | `?ticket` (no bearer) → `text/event-stream` of `{batch, status: running\|finished}` and, on connect and every 20 s, `{status: ping}` (ADR 66); `401` for an unknown, used or expired ticket |

`ImportBatch` is `{slug, termLang, meaningLang, createdAt, files: ImportFile[]}` in upload order; `ImportFile` is `{name, status: pending|running|done|failed, deck: {slug, title} | null, imported, skippedDuplicates, errors (≤100), totalErrors}`.

Every `Deck` carries `snooze: {until: Instant | null} | null`: `null` when the deck is not snoozed or a timed snooze has ended. A snoozed deck's words are left out of `/notifications`, `/hard-words` and hard-words sessions; its own deck page and sessions are unchanged.

## Community

| Method | Path | Body → Response |
|---|---|---|
| GET | `/community/decks` | `?q&termLang&sort=new\|forks&cursor` → `Page<PublicDeck>` |
| GET | `/community/decks/:deckSlug` | → `PublicDeck & {preview: Word[≤20]}` |
| POST | `/community/decks/:deckSlug/fork` | → `Deck` (the new private copy) |

## Study

| Method | Path | Body → Response |
|---|---|---|
| POST | `/sessions` | `{scope: {kind:"deck",deckSlug} \| {kind:"hard"}, drills: ("term_meaning"\|"meaning_term"\|"term_reading"\|"reading_term")[] (1–4, unique), size: 7\|10\|15\|20, mode: "easy"\|"hard"}` → `Session` |
| GET | `/sessions/active` | → `Session \| null` (resume after reload) |
| POST | `/sessions/:sessionSlug/answers` | `{position, chosenWordSlug, latencyMs}` → `{correct, correctWordSlug, nextDue \| null, retry: Question \| null, completed, leech, reading \| null}` (`reading`: the answered word's, for the feedback) |
| POST | `/sessions/:sessionSlug/abandon` | → `204` (end early; uncleared words were already rescheduled on attempt 1) |
| GET | `/hard-words` | `?drill&q&cursor&limit` → `Page<WordWithCard & {deck: {slug, title, termLang, meaningLang}}> & {summary: {total, dueToday, drills: [{drill, count, termLang}]}}` (the list spans decks). The summary covers every hard word, whatever `drill` and the page; `dueToday` counts words with a hard card due now; `drills` lists the drills that have hard cards, in drill order, with the first such word's `termLang` (FR-31). `q` keeps the words whose term, reading or meaning contains it (same matching as a deck's word search) and combines with `drill`; the summary ignores it |
| PUT | `/words/:wordSlug/drills/:drill/hard` | → `204` (mark that card) |
| DELETE | `/words/:wordSlug/drills/:drill/hard` | → `204` (unmark) |

```ts
Question = {
  position, attempt,                                // attempt ≥ 2 ⇒ retry
  wordSlug: "4HNCR8WYK2JD",
  drill, drillLabel,                                // per question: sessions can mix directions
  prompt: { text, ruby: null },                     // always null: no reading hints (FR-17)
  options: ReadonlyArray<{ wordSlug: "4HNCR8WYK2JD", text }> // 4, shuffled; text = word's drill.answer value
}
Session = {
  slug: "G7PX2MQ9VB4KR8", drills, termLang, mode, size, status,
  cleared: number,                                  // progress = cleared / size
  questions: ReadonlyArray<Question>                // pending only, in position order
}
```

## Insight

| Method | Path | Body → Response |
|---|---|---|
| GET | `/words/:wordSlug/stats` | → `{ word, drills: WordStats[] }`, one entry per drill the word has a card in (see [10](10-analytics.md)) |
| GET | `/decks/:deckSlug/stats` | → `DeckStats` |
| GET | `/me/stats` | → `LearnerStats`: `DeckStats` over all live decks, plus `streak: {days, studiedToday}` (see [10](10-analytics.md)) |
| GET | `/me/activity` | `?month=YYYY-MM` (default: the current study month) → `{ month: "2026-11", days: [{date: "2026-11-04", reviews: 23}] }`: only days with reviews. A future month returns `days: []`; the UI never asks for one (FR-18) |
| GET | `/notifications` | → `{ decks: [{deckSlug, title, due, overdue, byDrill: [{drill, label, due}]}], hardDue, newAvailable }` |

## Ops
`GET /api/healthz` → `204` when `SELECT 1` succeeds.

## Errors

| `_tag` | Status | When |
|---|---|---|
| `Unauthorized` | 401 | Missing, invalid, or expired access token |
| `RefreshTokenInvalid` | 401 | Refresh token unknown, expired, revoked, or reused (the family is revoked) |
| `Forbidden` | 403 | The resource belongs to another Learner |
| `NotFound` | 404 | — |
| *(empty body)* | 400 | Schema decoding of params, query, or body failed. Effect's built-in `HttpApiSchemaError` answers with an empty `400`. The frontend validates with the same contract Schemas before sending and shows field errors itself, so a 400 means a client bug |
| `DuplicateWord` | 409 | Same `termKey` and `readingKey` already in the deck |
| `DuplicateWords` | 409 | `{indexes}`: every word of a batch whose keys a live deck word or another word of the batch holds; nothing is saved |
| `QuestionAlreadyAnswered` | 409 | Double submit of the same position |
| `SessionNotActive` | 409 | Answering a completed or abandoned session |
| `DeckTooSmall` | 422 | Fewer than 4 words with distinct answers for the chosen drill |
| `DrillNotAvailable` | 400 | None of the selected drills applies to any word in the scope |
| `DeckNotPublic` | 404 | Forking a private deck. Returns 404 so it doesn't reveal that the deck exists |
| `ImportRejected` | 422 | `{errors: [{row, column, message}] (≤100), totalErrors}` |
| `PayloadTooLarge` | 413 | CSV larger than 5 MB |
| `ImportRunning` | 409 | Dismissing a batch that still has a pending or running file |

Ownership is checked in the application layer by scoping every query with `learner_id`. As a result, a resource owned by someone else returns `NotFound`, and `Forbidden` is used only for actions on a public deck that the Learner does not own.
