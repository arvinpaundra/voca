# 07 — HTTP API

The API is defined once in `contract/` as an `@effect/platform` `HttpApi`:
- The backend implements it with `HttpApiBuilder`.
- The frontend consumes it through `HttpApiClient.make(VocaApi)`.
- `HttpApiSwagger` serves OpenAPI at `/docs` outside production.

Conventions:
- **Slugs:** every `:deckSlug`, `:wordSlug`, and `:sessionSlug` path parameter and every `*Slug` field is a slug: random uppercase Crockford base32 with no prefix. Lengths: learner 8, deck 10, word 12, session 14. Internal `bigint` IDs never appear. Lowercase input is accepted and uppercased. An ID with the wrong prefix or a malformed ULID → `400 ValidationError`.
- JSON bodies.
- `Authorization: Bearer <access>` on every route except `/auth/*` and `/healthz`.
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

On `/auth/google`, `timezone` is used only when the account is created.

## Library

| Method | Path | Body → Response |
|---|---|---|
| GET | `/decks` | → `DeckSummary[]` (own decks, with `wordCount` and `dueCount`) |
| POST | `/decks` | `{title, description?, termLang, meaningLang}` → `Deck` |
| GET | `/decks/:deckSlug` | → `Deck` |
| GET | `/decks/:deckSlug/drills` | → `[{drill, label, due, new}]`: only drills that apply to at least one word (FR-17) |
| PATCH | `/decks/:deckSlug` | `{title?, description?, termLang?, meaningLang?}` → `Deck` |
| DELETE | `/decks/:deckSlug` | → `204` |
| POST | `/decks/:deckSlug/publish` | → `Deck` |
| POST | `/decks/:deckSlug/unpublish` | → `Deck` |
| GET | `/decks/:deckSlug/words` | `?q&cursor&limit` → `Page<WordWithCard>` |
| POST | `/decks/:deckSlug/words` | `{term, meaning, reading?, example?, notes?}` → `Word` |
| PATCH | `/words/:wordSlug` | partial Word → `Word` |
| DELETE | `/words/:wordSlug` | → `204` |
| POST | `/decks/:deckSlug/import` | `multipart/form-data` field `file` (≤ 5 MB) → `{imported, skippedDuplicates}` |
| GET | `/decks/:deckSlug/export` | → `text/csv` |

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
| POST | `/sessions/:sessionSlug/answers` | `{position, chosenWordSlug, latencyMs}` → `{correct, correctWordSlug, nextDue \| null, retry: Question \| null, completed, leech}` |
| POST | `/sessions/:sessionSlug/abandon` | → `204` (end early; uncleared words were already rescheduled on attempt 1) |
| GET | `/hard-words` | `?drill&cursor` → `Page<WordWithCard>` |
| PUT | `/words/:wordSlug/drills/:drill/hard` | → `204` (mark that card) |
| DELETE | `/words/:wordSlug/drills/:drill/hard` | → `204` (unmark) |

```ts
Question = {
  position, attempt,                                // attempt ≥ 2 ⇒ retry
  wordSlug: "4HNCR8WYK2JD",
  drill, drillLabel,                                // per question: sessions can mix directions
  prompt: { text, ruby: string | null },            // ruby = reading, only in term_meaning
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
| GET | `/notifications` | → `{ decks: [{deckSlug, title, due, overdue, byDrill: [{drill, label, due}]}], hardDue, newAvailable }` |

## Ops
`GET /healthz` → `200 ok` when `SELECT 1` succeeds.

## Errors

| `_tag` | Status | When |
|---|---|---|
| `Unauthorized` | 401 | Missing, invalid, or expired access token |
| `RefreshTokenInvalid` | 401 | Refresh token unknown, expired, revoked, or reused (the family is revoked) |
| `Forbidden` | 403 | The resource belongs to another Learner |
| `NotFound` | 404 | — |
| `ValidationError` | 400 | Schema decoding failed. Includes the path and message of each issue |
| `DuplicateWord` | 409 | Same `termKey` and `readingKey` already in the deck |
| `QuestionAlreadyAnswered` | 409 | Double submit of the same position |
| `SessionNotActive` | 409 | Answering a completed or abandoned session |
| `DeckTooSmall` | 422 | Fewer than 4 words with distinct answers for the chosen drill |
| `DrillNotAvailable` | 400 | None of the selected drills applies to any word in the scope |
| `DeckNotPublic` | 404 | Forking a private deck. Returns 404 so it doesn't reveal that the deck exists |
| `ImportRejected` | 422 | `{errors: [{row, column, message}] (≤100), totalErrors}` |
| `PayloadTooLarge` | 413 | CSV larger than 5 MB |

Ownership is checked in the application layer by scoping every query with `learner_id`. As a result, a resource owned by someone else returns `NotFound`, and `Forbidden` is used only for actions on a public deck that the Learner does not own.
