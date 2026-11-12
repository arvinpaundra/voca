# 02 — Domain Model & Ubiquitous Language

These terms are used **verbatim** in code, the API, the database, and the UI. If a word is not in this glossary, it should not appear as a type name.

## Glossary

| Term | Meaning | Avoid saying |
|------|---------|--------------|
| **Learner** | A signed-in person | user (fine in the Identity context only), member |
| **Deck** | An owned, named collection of Words in one term language | collection, set, folder |
| **Word** | One vocabulary entry: term, reading?, meaning, example?, notes? | card (in Library), note, entry, item |
| **Term** | The thing being learned, in `termLang` | front, question |
| **Reading** | The pronunciation of the Term in the language's own system: hiragana for Japanese (for kanji and katakana terms alike), pinyin for Chinese, jyutping for Cantonese | phonetic, furigana, romaji |
| **Field** | One part of a Word that a Drill can show or ask: `term`, `reading`, or `meaning` | side, face |
| **Drill** | A question direction, prompt Field → answer Field: `term_meaning`, `meaning_term`, `term_reading`, or `reading_term`. Chosen before each Session | direction, card type, quiz type |
| **Language Profile** | Code constant per `termLang` that only supplies Field labels (ja: Word / Hiragana, zh: Hanzi / Pinyin) | locale, language config |
| **Meaning** | The answer, in `meaningLang` | back, translation, definition |
| **Card** | The **memory state** of one (Word, Drill) pair: stability, difficulty, due, reps, lapses. Created on the first answer | — |
| **Review** | One graded answer to a Card. Immutable, append-only | attempt, answer log |
| **Rating** | FSRS grade: `Again \| Hard \| Good \| Easy` | score, grade |
| **Session** | A fixed list of Questions (7/10/15/20) answered in one sitting | quiz, round |
| **Question** | One showing of a session Word with 4 Options. Also called an attempt | item, task |
| **Attempt** | The n-th Question for the same Word in a Session. Attempt 1 is rated; later attempts are **Retries** | try |
| **Retry** | A Question re-created after a wrong answer, repeated until the Word is answered correctly | repeat, redo |
| **Cleared** | A session Word that has been answered correctly. It does not return in that Session | done, passed |
| **Slug** | The external identifier: random uppercase Crockford base32. Length per model: Learner 8, Deck 10, Word 12, Session 14 | id, public id (`id` means the internal `bigint` only) |
| **Option** | A candidate answer (the Word's value for the Drill's answer Field), identified by its Word id | choice |
| **Distractor** | A wrong Option | — |
| **Mode** | `easy` (random distractors) or `hard` (similar distractors) | difficulty (that name is taken by FSRS) |
| **Due** | A Card with `due ≤ now` | pending, scheduled |
| **Study day** | A Learner-local day that starts at `dayStartHour` in their timezone | date |
| **Hard Word** | A Card (Word in one Drill) the Learner flagged. It is a flag, not a Deck | difficult word, favorites |
| **Leech** | A Card with lapses ≥ 4. It is suggested as a Hard Word | — |
| **Lapse** | A Review rated `Again` on a Card that had already been reviewed before | fail |
| **Publish / Unpublish** | Change a Deck's visibility between `private` and `public` | share |
| **Fork** | Copy a public Deck into your own library | clone, import, subscribe |
| **Import** | Add Words to a Deck from a CSV file | upload |

## Bounded contexts

```
┌────────────┐   learnerId    ┌──────────────────────────┐
│  Identity  │ ─────────────▶ │         Library          │
│ Learner,   │                │ Deck, Word, Import, Fork │
│ Session-   │                └────────────┬─────────────┘
│ Token      │                  wordId     │ (Cards created lazily per Drill on first answer)
└─────┬──────┘                             ▼
      │ learnerId             ┌──────────────────────────┐
      └─────────────────────▶ │          Study           │
                              │ Card, Review, Session,   │
                              │ Scheduler (FSRS)         │
                              └────────────┬─────────────┘
                                           │ reads (SQL read models)
                                           ▼
                              ┌──────────────────────────┐
                              │         Insight          │
                              │ WordStats, DeckStats,    │
                              │ Notifications            │
                              └──────────────────────────┘
```

- **Identity**: Learner, Google identity, refresh-token families, Learner settings.
- **Library**: Deck and Word lifecycle, CSV import, publishing, forking. It does not know anything about scheduling.
- **Study**: Cards, the FSRS scheduler, Sessions, Reviews, Hard Word flags. This is the core domain, so most of the design effort goes here.
- **Insight**: read-only projections built with SQL over Study and Library tables. It has no aggregates.

There is no event bus. Contexts communicate through application-layer calls inside the same transaction. Creating a Word does not create Cards; they are created lazily per Drill on the first answer. `ponytail:` add domain events only when a second consumer appears.

## Aggregates & invariants

**All invariants below are enforced in code** by Schemas and domain functions, not by database `CHECK`s. They are checked on the way into the system (request decoding, domain constructors) and again on the way out of the database (row decoding). The database keeps only `UNIQUE` indexes, which guard against races between concurrent requests. See [06](06-data-model.md).

Deletes are **soft deletes** (`deletedAt`). Removing a Deck or Word cascades to its children through an explicit use-case step, never through the database.

### Learner (Identity)
- `googleSub` is unique. `timezone` is a valid IANA zone. `dayStartHour` is in 0..23. `desiredRetention` is in 0.80..0.95. `newPerDay` is in 0..200. `defaultSessionSize` ∈ {7, 10, 15, 20}. Defaults for a new Learner: `dayStartHour 4`, `desiredRetention 0.90`, `newPerDay 20`, `defaultSessionSize 10`, `defaultMode easy` (ADR 28).

### Deck (Library), the root of Words
- It has exactly one owner, and only the owner can change it.
- `termLang` and `meaningLang` are valid BCP-47 tags. `termLang` cannot change once the Deck has Words, because similarity and rendering depend on it.
- Within a Deck, `(termKey, readingKey)` is unique.
- A Deck can only be forked while it is `public`.
- Size limit: 20,000 Words per Deck. This bounds hard-mode scoring and imports.

### Card (Study)
- Identified by `(word, drill)`, with at most one live Card per pair. It is soft-deleted with its Word.
- It is created only by the first answer in that Drill. No Card means the Word is new in that Drill.
- `stability > 0`, `difficulty ∈ [1, 10]`, and `due` and `lastReview` are always set. There is no `new` state.
- `drill` must apply to the Word: reading drills need a reading that differs from the term ([14](14-drills.md)).
- `reps` and `lapses` never decrease.

### Session (Study)
- `size ∈ {7, 10, 15, 20}`, and there are at most `size` distinct session Words. The number of Questions can be higher because of Retries.
- Each Word is selected at most once (FR-13).
- A Retry is created only from a wrong answer, and none are created after the Word is Cleared.
- A Word has at most one unanswered Question at a time.
- Only attempt 1 produces a Review, so there is at most one Review per Word per Session.
- A Session has a non-empty set of Drills. Each Question has one Drill from that set and shows that Drill's prompt Field and answer Field. A Retry keeps its Question's Drill.
- A Word appears in only one Drill per Session.
- A Question has exactly 4 distinct Options, exactly one of which is the prompt Word. No two Options have equal `answerKey`s (normalized answer values).
- A Question can be answered only once, and only while the Session is `active`.
- The Session is `completed` when every session Word is Cleared.
- A Learner has at most one `active` Session.

### Review (Study)
- Append-only. It records the before and after state, so history can be replayed (useful for future parameter optimization).

## Domain services (pure functions)

| Function | Context | Signature (conceptual) |
|---|---|---|
| `schedule` | Study | `(card, rating, now, params) → Card` |
| `retrievability` | Study | `(card, now) → number` |
| `ratingFromAnswer` | Study | `(correct, latencyMs) → Rating` |
| `similarity` | Study | `(a: string, b: string) → number ∈ [0, 1]` (applied to the drill's script-side Field) |
| `applies` | Study | `(drill, word) → boolean` |
| `languageProfile` | Study | `(termLang) → { termLabel, readingLabel }` |
| `pickDistractors` | Study | `(prompt, pool, mode, rng) → Option[]` |
| `studyDayBounds` | Study | `(now, timezone, dayStartHour) → { start, end }` |
| `normalizeKey` | Library | `(text) → string` (NFKC + case fold + trimmed whitespace) |
| `nextAttempt` | Study | `(question, correct) → Option<Retry>` (`None` when correct) |
| `slug` | shared | `(length, randomBytes) → string` (Crockford base32, uppercase) |
| `parseCsv` | Library | `(text) → Either<CsvError[], Row[]>` |

These functions do no IO and do not read the clock. `now` and `rng` are always passed in as arguments, which makes them deterministic and easy to property-test.
