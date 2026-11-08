# 01 — Functional Requirements (MVP)

Priority uses MoSCoW: **M**ust, **S**hould, **C**ould, **W**on't (in the MVP). Requirement IDs (`FR-x`) are referenced throughout the other docs.

## Actors

- **Visitor**: not signed in. Can only see the landing and sign-in page.
- **Learner**: a signed-in user who owns decks and studies them.
- **Publisher**: a Learner who has made a deck public. This is a role, not a separate account.

---

## FR-1 Spaced repetition study (M)

Works like Anki: each word has its own memory state, and the scheduler decides when it is due next.

- The scheduler uses FSRS-6 ([04](04-scheduling.md)). Each Learner has a desired retention setting (default 0.90, range 0.80–0.95).
- Learners answer **multiple-choice** questions in a chosen **Drill** (FR-17): they see the prompt (for example the term, or its pinyin) and pick the correct answer (for example the meaning, or its hiragana) from 4 options.
- The answer is turned into an FSRS rating automatically:
  - Wrong → `Again`
  - Correct but slow → `Hard`
  - Correct → `Good`
- New words are introduced up to a daily limit (setting, default 20/day).

**Acceptance**
- After an answer, the word's `due`, `stability`, and `difficulty` are updated in the same transaction that writes the review log.
- Only the first attempt at a word in a session is rated. A word answered `Again` becomes due no earlier than the next study day. Retries within the session (FR-13) do not change the schedule.

## FR-2 Decks (M)

A deck is the grouping unit: a named, ordered collection of words in one term language.

- Create, rename, describe, and delete decks. Deleting asks for confirmation, then hides the deck and its words everywhere, including Community. Deletes are soft (`deleted_at`): the review history is kept, but no restore UI is offered in the MVP.
- Each deck declares `termLang` and `meaningLang` as BCP-47 tags (e.g. `ja`, `zh-Hans`, `en`).
- Add, edit, and delete words manually.
- **Won't:** nested decks, tags. Revisit if users ask for them.

## FR-3 Language-agnostic content (M)

- A word has `term`, an optional `reading` (hiragana for ja, pinyin for zh; see FR-16), `meaning`, an optional `example`, and optional `notes`.
- All text is stored as Unicode NFC. Duplicates are detected with an NFKC + case-folded key, so `ｶﾀｶﾅ` and `カタカナ` collide and `Apple` and `apple` collide.
- The UI renders text with the correct `lang` attribute, so browsers choose the right CJK glyphs (Japanese 直 is drawn differently from Chinese 直). Readings render as `<ruby>` when present.
- Right-to-left scripts (ar, he, fa) render with `dir="auto"`.
- There is no per-language logic in the domain. Language only affects rendering and similarity (FR-12).

## FR-4 CSV batch import (M)

- Upload a UTF-8 CSV file of up to **5 MB** into an existing deck.
- Columns: `term,meaning[,reading][,example][,notes]`, with a required header row. `reading` takes hiragana for ja and pinyin for zh. `hiragana`, `pinyin`, and `jyutping` are accepted as aliases for `reading`. See [09](09-csv-import.md).
- The import is **all-or-nothing**. If any row is invalid, nothing is imported and the first 100 errors are returned with their row numbers.
- Rows that duplicate an existing word in the deck (same normalized term + reading) are skipped and counted, not treated as errors.
- **Should:** export a deck to CSV in the same format, so data round-trips.

## FR-5 Community decks (M)

- Decks are `private` by default. The owner can **publish** (make public) or **unpublish** a deck at any time.
- Any Learner can browse public decks, search them by title, filter by language, and sort by newest or most forked.
- Learners can preview up to 20 words of a public deck.
- **Fork**: copies the deck and all of its words into the Learner's library as a new private deck with fresh study state. Later changes by the original owner do not affect forks.
- The deck page shows a fork count and "forked from" attribution.
- **Won't:** ratings, comments, reports or moderation queue. An admin can unpublish a deck directly in the database.

## FR-6 Per-word analytics (M)

The word detail page shows the metrics defined in [10](10-analytics.md):

- Recall probability now and memory stability
- Difficulty, accuracy, lapses, and review count
- Average answer time
- Maturity
- Next due date
- A review history timeline
- **"Confused with"**: the wrong options this word's learner picked most often

A deck summary shows counts by maturity, a due forecast for the next 7 days, and true retention.

## FR-7 Notification panel (M)

- A bell in the header opens a panel listing:
  - each deck with words due now (due count, overdue count)
  - hard words that are due
  - new words still available today
- The panel is computed on request and nothing is stored. It refreshes when the window gains focus and every 5 minutes while the tab is visible.
- **Won't:** email, web push, OS notifications.

## FR-8 Hard Words (M)

- The Learner can mark or unmark a word as **hard** in a specific Drill: from the session result screen (the session's drill) or from the word page (one toggle per drill already studied).
- The app **suggests** a word as hard when it becomes a leech (lapses ≥ 4). Suggesting means a badge with one-click marking, not automatic marking.
- A **Hard Words** view lists all hard words across decks. The Learner can start a study session scoped to hard words. Hard words are scheduled normally; the view only filters them.

## FR-9 Timezone-agnostic due dates (M)

- Every timestamp is stored in UTC.
- Each Learner has an IANA timezone (detected from the browser on first sign-in, editable) and a day-start hour (default 04:00, the same as Anki).
- "Due today" means due before the Learner's next day start in their timezone.
- Changing the timezone never moves stored due instants. It only changes which local day they fall on. Behavior across DST changes is defined in [04](04-scheduling.md).

## FR-10 Google sign-in & token refresh (M)

- Sign in with Google. The first sign-in creates the account, so there is no separate registration form.
- The API issues an access token (15 min) and a refresh token (30 days, rotated on every use).
- The frontend refreshes silently. If a refresh token is reused, its whole token family is revoked (theft detection).
- Signing out revokes the current refresh token.
- No cookies. See [08](08-auth.md).

## FR-11 Session size (M)

- Session size is chosen from **7, 10, 15, or 20** words. The last choice is remembered as the default.
- If fewer words are due than the chosen size, the session is filled with new words (within the daily limit). If the session is still short, the smaller session is served with a notice.

## FR-12 Easy / Hard mode (M, can be cut)

- **Easy**: the 3 distractors are random answers (in the drill's answer field) from the same deck.
- **Hard**: the distractors are the most **similar** ones: look-alike or sound-alike terms for meaning drills, and similar hiragana or pinyin, or look-alike kanji and hanzi, for reading drills. See [05](05-study-sessions.md) and [14](14-drills.md).
- If there are not enough similar candidates, random distractors fill the gap.
- Cost estimate: about 1 day of backend work. It is kept in the MVP because it is pure, cheap to compute, and needs no extra tables.

## FR-13 Picked once, retried until correct (M)

- **Picked once:** a word is selected at most once for a session, so the `size` session words are distinct.
- **Correct answers never return:** once a word is answered correctly, it does not come back in this session.
- **Wrong answers come back:** a wrong word reappears (about 3 questions later, with freshly shuffled options) until the Learner answers it correctly.
- **Only the first attempt affects scheduling.** Retries are practice: they are recorded for analytics but do not change the word's due date or memory state.
- The session completes when every session word has been answered correctly. The Learner can end it early at any time.
- A Learner has **at most one active session**. Starting a new one abandons the previous one.
- Full design: [05](05-study-sessions.md).

## FR-16 Reading per language (M)

- A word has `term`, an optional `reading`, and `meaning`. There is no romanization field; nothing is forced into Latin script.
- What `reading` holds follows the language:
  - **ja:** hiragana, for kanji terms (食べる → たべる) and katakana terms (コーヒー → こーひー). Hiragana-only words leave it empty.
  - **zh:** pinyin with tone marks.
  - **yue:** jyutping.
  - **Other languages:** optional.
- Labels follow the language: Word / Hiragana for ja, and Hanzi / Pinyin for zh.

## FR-17 Drills: choose the direction before each session (M)

- Before starting a session, the Learner picks **one or more Drills** (directions), along with the size (FR-11) and the mode (FR-12). A session can mix directions.
- There are four drills in every language. Labels are shown per language, using ja and zh as examples:
  - **term_meaning:** Word → Meaning (Hanzi → Meaning)
  - **meaning_term:** Meaning → Word (Meaning → Hanzi)
  - **term_reading:** Word → Hiragana (Hanzi → Pinyin)
  - **reading_term:** Hiragana → Word (Pinyin → Hanzi)
- The reading drills apply only to words that have a reading.
- Only drills that apply to at least one word in the deck are listed, each with today's due and new counts. The default is the set last used for that deck.
- **Each (word, drill) is scheduled independently.** The daily new-word limit is shared across drills.
- **Mixed sessions:** each question shows its own direction label. A word appears in only one direction per session, so one question never reveals another's answer. Full design: [14](14-drills.md).

## FR-14 Sound effects (M)

- Short synthesized sounds (Web Audio API, no audio files) play for these session events: start, option tap, correct, wrong, retry appears, and session complete.
- A mute toggle is remembered per device. Every sound has a matching visual cue, so muting loses no information.

## FR-15 Slugs instead of IDs (M)

- The API and UI never expose internal IDs. Every resource is addressed by a **slug**: a random uppercase string with no prefix, whose length depends on the model.
  - Learner: 8 characters
  - Deck: 10 characters, for example `/decks/TQ7KM2PV9X`
  - Word: 12 characters
  - Session: 14 characters
- Internally, all keys are `bigint`. See [06](06-data-model.md).

## FR-18 Study activity heatmap (M)

- The home screen shows one month at a time as a calendar heatmap: one square per day, 7 columns, Sunday first. It opens on the current month.
- **‹ / ›** switch months. **›** is disabled on the current month, so future months can't be opened. **‹** is disabled on the month the Learner signed up.
- Days later than today in the current month are drawn as empty outlines, with no count.
- A square's shade shows how many reviews (first attempts) the Learner did that day, in 5 levels: none, then quartiles of that month's active days, the same way GitHub shades contributions.
- Days follow the study day (timezone and `dayStartHour`, FR-9), so a review at 01:00 on 1 Dec with `dayStartHour = 4` counts for 30 Nov.
- Hovering a square shows "23 reviews · Tue, 4 Nov 2026". The header shows the month's total.
- History is kept when a deck is deleted, so the heatmap never loses days.

---

## Extra ideas (not in your list)

| Idea | Priority | Why |
|------|----------|-----|
| FSRS instead of SM-2 | **M** (adopted) | Needs 20–30% fewer reviews for the same retention, and is the current state of the art |
| Daily new-word limit | **M** (adopted) | Without it, a 2,000-word import floods the review queue |
| "Confused with" metric | **M** (adopted) | Free byproduct of storing which option was picked; very useful for learners |
| Leech suggestion → Hard Words | **M** (adopted) | Fills FR-8 automatically instead of relying only on manual marking |
| CSV export | S | Lets users own their data; about 20 lines of code |
| Text-to-speech via the browser `speechSynthesis` API | C | Built into browsers, no dependency, supports ja and zh. Pronunciation helps with readings |
| Reverse direction (meaning → term) | C | Doubles practice value. Each word needs a second card, so it is deferred |
| Typed-answer mode | W | Needs fuzzy grading per script; too much for the MVP |
| Personal FSRS parameter optimization | W | Needs about 1,000+ reviews per user. Revisit after launch |
| Offline / PWA | W | YAGNI |

## Non-functional summary

Full details are in [03](03-architecture.md) and [12](12-deployment.md).

| NFR | Target |
|-----|--------|
| Scale | Thousands of users on a single small VM. Budget: 1 API pod at 256 MiB, p95 < 100 ms for study endpoints, Postgres shared with other workloads |
| Language | Bun + TypeScript (strict). Effect on the backend; Effect Schema and HttpApiClient on the frontend |
| Architecture | DDD with a ubiquitous language, layered per bounded context, functional core with monadic Effect pipelines, no exceptions in domain logic |
| Auth | Bearer tokens only (JWT HS256 access token + opaque refresh token) |
| Import | Up to 5 MB CSV, synchronous, atomic |
| Testing | Integration tests against real Postgres for scheduling, sessions, analytics, and timezone correctness |
| Principles | YAGNI, KISS, clean code, minimal dependencies (budget in [03](03-architecture.md)) |
