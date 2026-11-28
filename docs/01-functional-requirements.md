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
- New cards are tracked against a daily target (setting "New cards per day", default 20/day). A card is one word in one drill. The target never limits a session (FR-36).

**Acceptance**
- After an answer, the word's `due`, `stability`, and `difficulty` are updated in the same transaction that writes the review log.
- Only the first attempt at a word in a session is rated. A word answered `Again` becomes due no earlier than the next study day. Retries within the session (FR-13) do not change the schedule.

## FR-2 Decks (M)

A deck is the grouping unit: a named, ordered collection of words in one term language.

- Create, rename, describe, and delete decks. Deleting asks for confirmation, then hides the deck and its words everywhere, including Community. Deletes are soft (`deleted_at`): the review history is kept, but no restore UI is offered in the MVP.
- Each deck declares `termLang` and `meaningLang` as BCP-47 tags (e.g. `ja`, `zh-Hans`, `en`).
- Add, edit, and delete words manually.
- On a deck page, clicking or tapping anywhere on a word's row opens a modal with all of its information: the term, reading, meaning, example and notes, and the per-word analytics of FR-6. The row's own edit and delete buttons open the editor or the delete confirmation instead. The modal is view only; its one action is "Full details", to the word page. Closing it (✕, Esc, or a tap outside) leaves the Learner on the deck page at the same scroll position.
- In a Community deck preview (FR-5), clicking anywhere on a word's row opens the same modal, view only: the word's content, without analytics, edit, delete or "Full details".
- **Won't:** nested decks, tags. Revisit if users ask for them.

**Acceptance**
- Clicking anywhere on a word's row on a deck page, its meaning as well as its term, opens its modal, and the URL stays on the deck page.
- The row's edit and delete buttons open the editor or the delete confirmation, never the modal.
- The modal shows the term, reading, meaning, example and notes, and leaves out an empty field rather than showing it blank. For the Learner's own deck it also shows the FR-6 metrics.
- The modal offers no edit or delete.
- "Full details" opens the word page, which still works as before.
- Closing the modal returns to the deck page at the same scroll position.
- In a Community deck preview, clicking anywhere on a word's row opens the modal, which shows only the word's content and offers no edit, delete or "Full details".

## FR-3 Language-agnostic content (M)

- A word has `term`, an optional `reading` (hiragana for ja, pinyin for zh; see FR-16), `meaning`, an optional `example`, and optional `notes`.
- All text is stored as Unicode NFC. Duplicates are detected with an NFKC + case-folded key, so `ｶﾀｶﾅ` and `カタカナ` collide and `Apple` and `apple` collide.
- The UI renders text with the correct `lang` attribute, so browsers choose the right CJK glyphs (Japanese 直 is drawn differently from Chinese 直). Readings render as `<ruby>` when present.
- Right-to-left scripts (ar, he, fa) render with `dir="auto"`.
- There is no per-language logic in the domain. Language only affects rendering and similarity (FR-12).

## FR-4 CSV batch import (M)

- Upload a UTF-8 CSV file of up to **5 MB** into an existing deck.
- Columns: `term,meaning[,reading][,example][,notes]`, with a required header row. `reading` takes hiragana for ja and pinyin for zh. `hiragana`, `pinyin`, and `jyutping` are accepted as aliases for `reading`. Columns with other names are matched by the Learner before importing (FR-35). See [09](09-csv-import.md).
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
  - new cards still available today, whatever the daily target (FR-36), **capped by the words that actually have no Card yet**, so the
    count is never a promise the decks can't keep
  - about how long the queue will take, from the Learner's own pace ([10](10-analytics.md))
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
- Signing out revokes the token's whole family ([08](08-auth.md)).
- No cookies. See [08](08-auth.md).

## FR-11 Session size (M)

- Session size is chosen from **7, 10, 15, or 20** words. The last choice is remembered as the default.
- If fewer words are due than the chosen size, the session is filled with new words (within the daily limit). If the session is still short, the smaller session is served with a notice.
- A session always holds at least one word. When nothing is due and no new word is left, no session is created and the
  app says so instead (`NothingToStudy`), rather than opening an empty session.

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
- Labels follow the language: Word / Kana for ja (FR-34), and Hanzi / Pinyin for zh.

## FR-17 Drills: choose the direction before each session (M)

- Before starting a session, the Learner picks **one or more Drills** (directions), along with the size (FR-11) and the mode (FR-12). A session can mix directions.
- There are four drills in every language. Labels are shown per language, using ja and zh as examples:
  - **term_meaning:** Word → Meaning (Hanzi → Meaning)
  - **meaning_term:** Meaning → Word (Meaning → Hanzi)
  - **term_reading:** Word → Kana (Hanzi → Pinyin)
  - **reading_term:** Kana → Word (Pinyin → Hanzi)
- The reading drills apply only to words that have a reading.
- Only drills that apply to at least one word in the deck are listed, each with today's due and new counts. The default is the set last used for that deck.
- **Each (word, drill) is scheduled independently.** The daily new-card target counts each (word, drill) once, on its first review (FR-36).
- **Mixed sessions:** each question shows its own direction label. A word appears in only one direction per session, so one question never reveals another's answer. Full design: [14](14-drills.md).
- **No reading hints:** a question's prompt and its options never show a word's reading as ruby. The reading appears only where it is the prompt (`reading_term`) or the answer (`term_reading`). Once a question is answered, the feedback shows the word's reading.

**Acceptance**
- No `term_meaning` or `meaning_term` question shows a reading, in its prompt or its options, before it is answered.
- After any answer to a word that has a reading, the feedback shows that reading.

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

## FR-19 Dashboard (M)

The signed-in home at `/app`, top to bottom:
- **Streak:** consecutive study days, with a nudge to study today when today has no review yet.
- **Today:** due, overdue, hard words due and new words available, with a Start studying button (FR-7's counts).
- **Activity:** the heatmap (FR-18).
- **Progress:** cards by maturity (new, learning, mature), true retention and calibration over 30 days, reviews per day over 30 days, and the due forecast for the next 7 study days.
- **My decks:** each deck with its languages, word count and due count.
- **Backlog hint:** when a deck that isn't snoozed (FR-20) has a big backlog, a hint above Today names it, e.g. "Japanese N4 has 84 words due. You can snooze a deck from its page." A big backlog means more due words than 3 × the Learner's remembered session size (FR-11), and never fewer than 30. When several decks qualify, one hint lists them all. The hint only informs: it has no button and no dismiss. It goes away once no deck qualifies.
- **Won't:** tags, weekly chart, "words mastered", "best deck". They need definitions the data model does not have.

**Acceptance**
- With a remembered session size of 20, a deck with 61 due words shows the hint and a deck with 60 shows none. With a size of 7, the threshold is 30, not 21.
- The count is every due word in the deck, overdue or not.
- A snoozed deck never appears in the hint, whatever its due count.
- When two or more decks qualify, exactly one hint is shown, and it lists each of them with its due count.
- The hint has no action or dismiss control, and it is gone on the next load once no deck qualifies.

## FR-20 Deck snooze (S)

A Learner who falls behind watches the due count keep growing, and the number alone can make them quit. Snoozing sets chosen decks aside, so the counts they are nagged with stay at a size they can face.

- From the deck page, or by selecting several decks in the library, the Learner snoozes them for **1, 3, 7 or 14 days**, or **until unsnoozed** (no end date). They can unsnooze at any time.
- While a deck is snoozed, its words are left out of the notification panel (FR-7), the dashboard's Today counts and Start studying (FR-19), the Hard Words view and its session (FR-8), and the new-word allowance.
- Snooze only hides. Due dates do not move, so a deck's backlog is still there when it comes back.
- A snoozed deck shows "Snoozed until <date>" (or "Snoozed" with no end date) in the library and on its deck page.
- The Learner can still start a session from a snoozed deck's own page; it works as for any other deck.
- A timed snooze ends at the Learner's day start (FR-9) on its end date.
- In select mode, a tap or click anywhere on a deck row ticks or unticks it and never opens the deck page. The Learner leaves select mode (Done) to open a deck.
- **Won't:** snoozing a single word.

**Acceptance**
- While a deck is snoozed, its words add 0 to the counts in the notification panel and on the dashboard, and are never picked for a session started from the dashboard or from Hard Words.
- Unsnoozing, or reaching the end of a timed snooze, brings the deck's words back into those counts on the next request.
- A snooze with no end date lasts until the Learner unsnoozes.
- Snoozing and unsnoozing never change any word's `due`, `stability` or `difficulty`.
- A session started from a snoozed deck's page serves its words as it would without the snooze.
- In select mode, a tap anywhere on a deck row changes only that row's tick, and the page stays on the library. Outside select mode, a tap on a row opens the deck page.

## FR-21 Flashcards (S)

Sometimes a Learner wants to flip through a deck without the pressure of a graded quiz. Flashcards are a light way to go over the words.

- From a deck page, the Learner starts flashcards with **7, 10, 15 or 20** words, or **all** of the deck's words. The words are picked and ordered at random, with a fresh shuffle every run.
- The front shows the term only, without its reading. A tap or click flips the card with a turn animation, and the back shows the reading, meaning, example and notes, but never the term, even for a word with no reading. The animation always plays.
- Swipe right (or →) means "remembered", and swipe left (or ←) means "not yet". Buttons do the same, for mouse users and for accessibility.
- One pass: every card is shown once, and "not yet" cards do not come back within the run.
- **Back** returns to the previous card and undoes its swipe, all the way to the first card.
- At the end, a summary shows the remembered and not-yet counts.
- Flashcards are practice only. Swipes are not stored and do not touch scheduling, analytics, the heatmap or the streak.
- **Won't:** grading, timers, multiple choice, or saving a run to resume later.

**Acceptance**
- A run with size N (or all) shows min(N, deck word count) distinct words, each exactly once. Two runs of a deck of 3 or more words can come in different orders.
- The front never shows the reading. After a flip, the card shows the reading, meaning and any example and notes, and never the term.
- Every flip, to the back and back to the front, plays the turn animation.
- After k swipes, pressing Back k times returns to the first card, and the summary counts only the swipes that are left.
- A flashcard run never changes any word's `due`, `stability` or `difficulty`, adds no review, and leaves the heatmap and streak unchanged.

## FR-22 Release (M)

The owner needs to ship Voca to `voca.arvinpaundra.xyz`, and every later version, in one repeatable step. A broken build must never take down the working version. The first release also replaces the old Voca (the Go API at `vocaapi.arvinpaundra.dev`) and leaves nothing of it behind.

- The owner releases by pushing a version tag `vX.Y.Z` on a master commit. Nothing else deploys; merging to master does not.
- One release ships the API and the web app together, from the same commit. Both are served from `voca.arvinpaundra.xyz`, with the API under `/api`.
- A release runs only if that commit's CI `verify` passed. Otherwise nothing is deployed and the release is marked failed.
- A release replaces the running version with no failed requests. If the new API never becomes healthy, the previous version keeps serving and the release is marked failed.
- Production secrets live only in GitHub repository secrets. They are applied on every release and never committed.
- The owner rolls back by re-running the release for an older tag.
- Voca keeps a first-release checklist of its own: the one-time steps only the owner does, each with its command or the place to do it. It starts by setting the default kubectl context to `kube-oci` before any cluster command. It then covers removing the old Voca from the cluster (its deployment, service, ingress, secret and config), deleting the `vocaapi.arvinpaundra.dev` DNS record, dropping the old database and role, and creating a fresh, empty database. It ends with the Google OAuth redirect URIs, the GitHub secrets and the Cloudflare setup.
- The new Voca starts with an empty database. No users, decks or progress move from the old app.
- **Won't:** a staging environment, preview deploys per PR, automatic rollback, changelog generation, or migrating data from the old app.

**Acceptance**
- Pushing `v1.0.0` on a green master commit ends with `GET https://voca.arvinpaundra.xyz/api/healthz` → 204, and the page at `https://voca.arvinpaundra.xyz` is built from that commit.
- Pushing a tag on a commit whose `verify` failed deploys nothing, and the running version is unchanged.
- During a successful release, `GET /api/healthz` keeps answering 204.
- A release whose API never becomes healthy leaves the previous version answering 204, and the workflow run fails.
- No production secret value appears in the repository or in the workflow logs.
- Re-running the release for the previous tag restores that version.
- After the first release, `vocaapi.arvinpaundra.dev` no longer resolves, the cluster holds no resource of the old app, and the old database and role no longer exist.

---

## FR-23 Landing page for signed-in Learners (M)

The landing page ignores that the Learner is signed in, and its hero stretches the full width on large screens.

- The hero section keeps the same maximum width as the sections below it, centred, at every screen width.
- A signed-in Learner sees "Open app" in the header, leading to the Dashboard (FR-19), instead of "Sign in". "Start learning" also leads to the Dashboard.
- **Won't:** redirect a signed-in Learner away from `/`; the landing stays reachable.

**Acceptance**
- At 1920px wide, the hero's left and right edges line up with those of the section below it.
- A signed-in Learner on `/` sees no "Sign in" button; "Open app" and "Start learning" open the Dashboard.
- A Visitor sees "Sign in" as before.

## FR-24 Session survives a reload (S)

Extends FR-10. Every page load calls refresh today, even while the access token is still valid.

- The access token is stored alongside the refresh token, so a reload reuses it until it expires.
- A refresh happens only when the access token is missing, expired, or rejected by the API.

**Acceptance**
- Reloading within 15 minutes of the last refresh makes no call to the refresh endpoint.
- Reloading after the access token expired makes exactly one refresh call, and the Learner stays signed in.
- Signing out removes both tokens; after a reload the Learner is signed out.

## FR-25 CSV import template (S)

**Replaced by FR-35**: the import modal no longer offers a template; any header works once its columns are matched.

Extends FR-4. Learners shouldn't have to guess the CSV format.

- The Import CSV modal offers "Download template": `voca-template.csv`, the canonical header row `term,meaning,reading,example,notes` and nothing else.
- **Won't:** example rows, per-language aliases in the header.

**Acceptance**
- The downloaded file is UTF-8 and contains exactly the line `term,meaning,reading,example,notes`.
- Importing the template unchanged succeeds with 0 words added.

## FR-26 Add several words at once (S)

Extends FR-2. Adding words one by one is slow.

- The Add word modal holds a list of words. "Add another" appends a word with the same fields as today.
- Each word folds like an accordion: folded, it shows a one-line summary (term · meaning); only the word being edited is open.
- A word can be removed from the list before saving. One "Add N words" button saves them all.
- The list holds at most **50** words.
- Saving is all-or-nothing: an invalid word, or one duplicating a word in the deck or elsewhere in the list, is marked and opened, and nothing is saved until every error is fixed.

**Acceptance**
- Adding 3 valid words saves all 3; the deck shows 3 new rows.
- With 1 invalid word among 3, none are saved and the invalid word is open with its error shown.
- Two words in the list with the same term and reading are both flagged as duplicates, and nothing is saved.
- With 50 words in the list, "Add another" is disabled.

## FR-27 Foldable directions in the word modal (S)

Extends FR-2 and FR-6. The word modal shows five metrics for each of up to four directions at once, which overwhelms.

- Each direction's metrics sit in their own foldable section. Folded, it shows the direction label and its recall now; unfolded, every metric as today.
- All directions start folded.
- **Won't:** change the metrics themselves, or the word page.

**Acceptance**
- Opening the word modal shows every direction folded, each with its label and recall-now percentage.
- Unfolding a direction shows its recall now, stability, lapses, reviews and accuracy; folding hides them again.
- The word page shows every FR-6 metric unchanged.

## FR-28 Deck list and Add words fixes (M)

Extends FR-2, FR-20 and FR-26. A deck's words can't be scrolled, the Add word modal can't be scrolled either and draws doubled borders, and cleaning up several decks means deleting them one by one.

- On a deck page, every word row can be reached by scrolling, however many words the deck has.
- In library select mode the actions are **Snooze**, **Unsnooze** and **Delete**; Delete is a danger button.
- Delete asks for confirmation naming how many decks will go, then deletes each selected deck as a single delete does (FR-2).
- In the Add word modal, adjacent words are separated by one border line, never two stacked.
- Clicking a word's header toggles it: a folded word opens, the open word folds. Every word can be folded at once.
- A folded word with no term and no meaning shows an **Empty** badge instead of a summary. A word with only one of them shows that one alone, with no stray separator.
- When the word list is taller than the modal, the list scrolls inside it and the "Add N words" button stays pinned at the bottom.
- **Won't:** undo of a bulk delete, a restore UI.

**Acceptance**
- In a deck with 29 words, the 29th row can be scrolled to and clicked, on desktop and at phone width.
- Selecting 3 decks and confirming Delete removes all 3 from the library, the dashboard and Community. Cancelling removes none.
- Unsnooze in select mode unsnoozes every selected snoozed deck and leaves the others unchanged.
- In the Add word modal, clicking the open word's header leaves 0 words open; clicking a folded word's header opens it.
- With 50 words in the list, the 50th can be scrolled to and opened, and "Add N words" stays visible throughout.
- Adjacent words never show a doubled border.
- A folded word with no term and no meaning shows "Empty"; one with only a term shows just the term.

## FR-29 Import several decks at once (S)

Extends FR-4. A Learner moving a collection into Voca has one file per deck; creating each deck and importing into it one at a time is tedious.

- From the library, "Import decks" takes up to **50** CSV files at once, totalling at most **50 MB**, each in the FR-4 format and within its limits.
- The Learner picks `termLang` and `meaningLang` once, with the same language picker as creating a deck: the offered languages, plus "Other…" for typing any language tag. Every deck in the batch uses them. Nothing is detected from the files.
- Each file becomes a new deck named after the file without its extension (`N5 verbs.csv` → `N5 verbs`). A name already used by another deck is allowed.
- A header-only file creates an empty deck.
- Each file is all-or-nothing on its own (FR-4): an invalid file creates no deck, and the other files still do.
- The import runs in the background. Its progress (files done out of total, the current file) is visible from any page and updates live, without a reload.
- Progress and the final per-file result survive a reload and a sign-out and sign-in, until the Learner dismisses them. The result shows, per file, the deck created with N words added and M duplicates skipped, or its errors.
- The Learner can start another batch while one is running; each batch shows its own progress.
- **Won't:** a language per file, language detection, cancelling a running batch, importing into existing decks (FR-4 covers that).

**Acceptance**
- Importing 5 valid files creates 5 decks, each named after its file and with the chosen languages.
- The Import decks language pickers offer the same languages as the create-deck modal, and "Other…" accepts a typed tag such as `yue`.
- Progress updates without a reload while the Learner moves between pages, and reaches 5/5.
- A file with an invalid row creates no deck and lists up to 100 errors with row numbers; the other files' decks are created.
- A header-only file creates a deck with 0 words.
- A file named like an existing deck creates a second deck with that name.
- More than 50 files, or files totalling more than 50 MB, are refused before anything is imported.
- After a reload, and after signing out and in, a running batch still shows its progress, and a finished one its result until dismissed.
- Two batches started back to back both complete, each with its own progress.

## FR-30 Choose the word font (S)

Extends FR-3. The default font makes kanji, kana and hangul hard to read; Learners need a typeface that shows their strokes clearly. Alphabetic text already reads well in the app font.

- In the settings, the Learner picks the font for word content from a fixed list of styles: **System default**, **Sans**, **Serif**, **Rounded**, **Handwriting** (textbook stroke forms).
- The style applies only to word content in a CJK language: Japanese (kanji, hiragana, katakana), Chinese (`zh-Hans`, `zh-Hant`) and Korean. Content in any other language (`en`, `id`, right-to-left scripts, …) always uses the app font, whatever style is chosen.
- It covers all of a word's content (term, reading, meaning, example, notes) that is in a CJK language, wherever it is shown: the deck page, the word modal, the word page, study sessions and flashcards. FR-34 narrows this to CJK characters only.
- The choice is remembered on that device; a new device starts with System default.
- **Won't:** custom font upload, font size, syncing across devices, changing the interface's own font, a font choice for alphabetic languages.

**Acceptance**
- After choosing Handwriting, a `ja`→`id` word renders its term and reading in the Handwriting style and its meaning in the app font, on the deck page, in the word modal and in a study session.
- After choosing Handwriting, an `id`→`en` word renders entirely in the app font.
- After a reload the choice still applies; in a fresh browser System default is used.
- Buttons, labels and navigation keep their current font.

## FR-31 Paged lists (M)

Extends FR-2, FR-5 and FR-8. A Learner with hundreds of decks or hard words waits for the whole list before seeing anything.

- The library (My decks), Discover, a deck's words and Hard words each load **15 items at a time**, in their current order.
- Every list ends with a "Load more" button that loads the next 15.
- On a phone (a screen 640 px wide or less) the next 15 also load by themselves when the Learner scrolls near the end. On a wider screen nothing loads until the button is used, so the page footer stays reachable.
- Loading a page never reorders or repeats an item already shown, even if a deck or word is added or deleted meanwhile.
- A search or filter change (Discover title, language, sort; deck word search; Hard words drill) starts again from the first page.
- Typing in a search box (My decks, Discover title, a deck's word search, Hard words) sends the search only after the Learner has stopped typing for **500 ms**. The box shows each keystroke at once, and the list on screen stays as it is until the search is sent. Pressing Enter, clearing the box, or using "Clear search" sends it immediately.
- Hard words has a search box that finds hard words by term or meaning. It works together with the drill filter, and a new search starts again from the first page.
- Counts that describe the whole collection (the library's "N decks", the dashboard and its backlog hint) cover every deck, not only the loaded ones.
- In library select mode, "select all" selects only the decks loaded so far.
- **Won't:** page numbers, jumping to the end, changing the sort orders, a delay for the language, sort and drill filters (they apply immediately), searching Hard words by deck name.

**Acceptance**
- With 40 decks, the library first shows 15; using "Load more" shows 30, then 40. On a phone, scrolling to the end does the same without the button. No deck appears twice.
- On a screen wider than 640 px, scrolling to the end of a list loads nothing; the "Load more" button does.
- The same holds for Discover (40 public decks), a deck with 40 words, and 40 hard words.
- Hard words shows its first 15 without waiting for the rest.
- Changing the Discover language filter resets the list to its first 15 matches.
- The dashboard's backlog hint still names a deck that isn't among the loaded 15.
- In select mode with 40 decks and 15 loaded, "select all" selects 15.
- On My decks, Discover, a deck's words and Hard words, typing "spa" with 100 ms between keystrokes sends one search for "spa" about 500 ms after the last key, not one per letter. A search changed again within 500 ms sends only the final text.
- Pressing Enter, or clearing the box, sends the search without waiting 500 ms.
- With 40 hard words, 3 of which contain "spa" in the term or meaning, searching "spa" shows exactly those 3.
- On Hard words, searching "spa" while a drill filter is set lists only that drill's hard words that match.

## FR-32 Screens fit the phone width (M)

Extends FR-2, FR-6, FR-19 and FR-31. A long term, example, note or drill label makes a screen wider than a phone. The header and text are cut off, and the page scrolls sideways (word page) or its content runs past the edge and can't be reached (dashboard).

- On every screen, content wraps inside the screen width, at every width. The page never scrolls horizontally, and nothing is clipped at the edge.
- This includes the word page and the word modal (term with its reading, meaning, example, notes, and each drill's section, also one that shows "Not studied yet"), and the dashboard (the Today counts, and each deck's drill label in the Today and My decks lists).
- The header stays fully visible and inside the screen.
- **Won't:** truncating content with "…", hiding it, or scrolling a row sideways as a workaround.

**Acceptance**
- At the phone breakpoint (640 px, FR-31) and at every narrower width down to 320 px, and also just above it at 641 px, a word whose term is 30 characters with a reading, and whose example and notes are 300 characters each, shows all of its text and the whole header. The page has no horizontal scroll. This holds on the word page, in the deck page's modal, and in a drill that has no card yet.
- At the same widths, the dashboard of a Learner with a deck whose drill label reads "Pinyin → Hanzi 1 · Meaning → Hanzi 2 · Hanzi → Meaning 1" shows all four Today counts (due, new, hard, overdue) and each full label. The page has no horizontal scroll.

## FR-33 Link previews when sharing (S)

Extends FR-23. A Voca link pasted into X, WhatsApp, Slack, Telegram or iMessage shows as a bare URL. A card with the name, a one-line pitch and an image makes the link recognisable and more likely to be opened.

- A link to the landing page (`/`) shows a card titled "Voca · Remember every word", with the same one-line description as the page's own, and a preview image.
- On X the card is a large image card, not a small thumbnail.
- The image is 1200×630 px. It shows the Voca logo with its lowercase "voca" wordmark and the line "Remember every word." on the app's dark background (`#1c1917`), with small flashcards and dots scattered around the edges, and its text stays legible at the small size a chat app shows it.
- A link to any other page (sign-in, Dashboard, a deck) shows the same card. The card never shows private content such as a deck's title or words.
- **Won't:** a card per public deck or per word, per-language cards, a card that changes with the Learner, or a Facebook app (`fb:app_id`).

**UI:** `docs/design/fr-33.html`

**Acceptance**
- The HTML served for `/`, `/login` and a deck URL, fetched without running JavaScript, has `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `twitter:card` ("summary_large_image") and `twitter:image`.
- `og:image` and `twitter:image` are absolute `https://` URLs. Opening one without signing in returns a 1200×630 PNG under 300 KB.
- Pasting the landing URL into a new X post shows the image as a large card (X shows no title or description).
- Pasting the landing URL into the Facebook Sharing Debugger shows the title, description and image. The only warning allowed is the missing `fb:app_id`.

## FR-34 Word font changes CJK characters only, "Kana", and long prompts (S)

Extends FR-30, FR-16 and FR-17. The word font changes every character of a Japanese or Chinese field, so the Latin letters and digits in an example such as 「Tシャツを3枚買った」 take the Handwriting face and read poorly. The Learner chose the font for kanji and kana, not for the Latin text around them. Separately, the Japanese reading is labelled "Hiragana", which Japanese learners don't use as a field name; "Kana" is the common word. And in a study session a long word or meaning is drawn as large as a short one, so on a phone it pushes the answers and the Next button below the screen.

- The chosen style applies character by character, only to kanji, hiragana, katakana, hanzi, hangul and CJK punctuation (。、「」).
- Latin letters, including pinyin and jyutping with tone marks, digits, Latin punctuation and spaces keep the app font, even inside a Japanese or Chinese field.
- A CJK character in any field of a word takes the style, including a meaning or note written in another language (`Polite form: 買います`). It uses the face for the deck's term language.
- The surfaces are those of FR-30: the deck page, the word modal, the word page, study sessions and flashcards.
- The settings row "Word font" says what it changes. Help: "Changes only kanji, kana, hanzi and hangul in your words. Latin letters (including pinyin), numbers and punctuation keep the app font." The preview becomes `勉強 · Tシャツを3枚 · belajar`.
- In a Japanese deck, the reading's label is **Kana** instead of **Hiragana** wherever it appears: the word form, word list, word modal, word page, flashcard back and Hard words. The reading drills read **Word → Kana** and **Kana → Word** everywhere a drill is named. The reading is still written in hiragana (FR-16), and the CSV still accepts `reading` and the `hiragana` alias.
- In a study session, the prompt's size follows its length (characters as typed, spaces included), and it wraps rather than being cut off:
  - 1–6 characters: as today (52 px on a phone, up to 80 px on desktop).
  - 7–14 characters: 36 px on a phone, 48 px on desktop.
  - 15 or more: 24 px on a phone, 32 px on desktop.
- On a phone (narrower than 640 px), once a question is answered, the result bar with Next is pinned to the bottom of the screen, above the browser's safe area, and never covers the last option. On wider screens it stays below the answers, as today.
- **Won't:** a style for Arabic, Hebrew, Thai, Cyrillic or other scripts (they keep the app font), a style for pinyin, a font change for form inputs, new styles, prompt sizing for flashcards.

**UI:** `docs/design/fr-34.html`

**Acceptance**
- After choosing Handwriting, a `ja` word whose example is `セールでTシャツを3枚買った。` renders the kana and kanji of the example in the Handwriting face and `T` and `3` in the app font, on the deck page, in the word modal, on the word page, in a study session and on a flashcard.
- After choosing Handwriting, a `ja`→`en` word whose notes are `Polite form: 買います` renders `買います` in the Handwriting face and `Polite form:` in the app font.
- After choosing Handwriting, a `zh-Hans` word 学习 with the reading `xuéxí` renders 学习 in the Handwriting face and `xuéxí` in the app font.
- After choosing Handwriting, an `id`→`en` word renders entirely in the app font.
- The settings row "Word font" shows the help text above, word for word, and the preview `勉強 · Tシャツを3枚 · belajar`.
- A Japanese deck shows "Word → Kana" and "Kana → Word" in the drill picker, as the question label and on the word page, and "Kana" as the reading label in the word form and word modal. No screen of a Japanese deck shows the word "Hiragana" as a label.
- A Chinese deck still shows "Hanzi → Pinyin" and "Pinyin"; a deck in another language still shows "Reading".
- In a study session, the prompt `食べる` is drawn at today's size, `お疲れ様でした` at 36 px on a phone and 48 px on desktop, and `to be absent-minded, to be careless` at 24 px on a phone and 32 px on desktop.
- At 390 × 664 (an iPhone 14 in Safari, toolbars shown), a question whose prompt is `to be absent-minded, to be careless` shows the prompt and all four options without scrolling.
- At 390 × 664, after answering a question whose prompt is 60 characters long, the Next button is on screen without scrolling, and tapping it moves to the next question.

## FR-35 Match CSV columns (S)

Extends FR-4 and FR-29, and replaces FR-25. Learners already keep vocabulary in spreadsheets with their own column names (`kosakata, arti, cara baca`). Renaming headers to Voca's before every import is tedious, and guessing names automatically would be unreliable. Instead, after picking files, the Learner tells Voca which of their columns is which field.

- Once a file is picked in Import CSV, the modal reads its first row as the header and adds a "Match columns" field: every column in file order, its name (or "Column N (no name)" when blank), and a dropdown: **Not imported**, **Term**, **Meaning**, **Reading**, **Example**, **Notes**.
- Only Term and Meaning are required. A column left on Not imported is ignored: its values are neither stored nor validated.
- No file sends two columns to one field. In Import CSV, choosing a field that another column has moves it there, and the other column goes back to Not imported.
- A column named `term`, `meaning`, `reading`, `example` or `notes`, or `hiragana`, `pinyin` or `jyutping` for Reading (ignoring case and surrounding spaces), starts matched to its field; if two columns want the same field, the first one gets it. Every other column starts on Not imported.
- Import stays disabled until Term and Meaning each have a column. Under the table, while true: "Choose a column for Term." · "Choose a column for Meaning."
- A file that can't be read (not UTF-8, or empty) shows "Can't read this file's header. Save it as CSV UTF-8 with a header row, then choose it again." before importing, and Import stays disabled.
- Row errors after importing name the field followed by the Learner's column: "Row 14, Meaning (arti): is required". Everything else about the import is unchanged (FR-4: synchronous, all-or-nothing, duplicates skipped, limits).
- In Import decks, "Match columns" sits between the files and the languages. It lists each distinct column name across all picked files once (ignoring case and surrounding spaces), with how many files have it ("50 files"), most common first; blank header cells share one "(no name)" row. A name is matched once for the whole batch, wherever it sits in each file. So identical headers, the same names in a different order, and completely different names all work in one batch, at one row per distinct name.
- In Import decks, different names may share a field (`kosakata` in some files and `word` in others, both on Term), as long as no single file has both.
- In Import decks, the rules are checked per file, and Import stays disabled until every file passes. Each problem gets one line naming its files, the first 3 then "and N more", in this order: "Meaning is chosen for 2 columns in 1 file: Bab 7.csv. Pick one." · "3 files have no column for Term: …" · "3 files have no column for Meaning: Bab 4.csv, Bab 5.csv, Bab 6.csv." A file that can't be read is listed with the error above and a Remove button.
- Import decks still runs in the background: on Import the modal closes and the batch shows in the Imports panel with its progress and per-file results, unchanged (FR-29).
- The "Download template" link is removed. The file picker's hint reads "CSV with a header row · UTF-8 · up to 5 MB" ("· 5 MB each" in Import decks).
- Matches aren't remembered: choosing other files, or reopening the modal, starts again from the headers.
- **Won't:** two columns of one file on one field, one column name meaning different fields in different files of one batch, remembering matches between imports, typing column names instead of reading the files, files without a header row, choosing which row is the header, merging or splitting columns, a template download.

**UI:** `docs/design/fr-35.html`

**Acceptance**
- Picking a file with header `kosakata,arti,cara baca` lists 3 columns in that order, each on Not imported, shows "Choose a column for Term." and "Choose a column for Meaning.", and Import is disabled.
- After choosing kosakata → Term and arti → Meaning, with cara baca left on Not imported, Import is enabled; importing adds words with term and meaning from those columns and no reading.
- A file with header `Term, MEANING ,pinyin` starts matched to Term, Meaning, Reading, and Import is enabled without changes.
- Any column can be matched to Reading, whatever its name: `cara baca` or `furigana` matched to Reading imports its values as the reading. A file with no Reading column imports with empty readings.
- A column on Not imported is not stored, and a value in it longer than any field limit causes no error.
- With kosakata on Meaning, choosing Meaning for arti moves it: kosakata goes back to Not imported.
- A blank header cell is listed as "Column N (no name)" and can be matched like any other column.
- A non-UTF-8 file shows the can't-read message, lists no columns, and Import is disabled.
- A row error after importing names the field and the column, e.g. "Row 14, Meaning (arti): is required", and nothing is imported.
- In Import decks, 50 files with headers `kosakata,arti,cara baca` or `cara baca,kosakata,arti` list 3 rows, each "50 files"; matching them once imports all 50 decks with the words in the right fields.
- In Import decks, 30 files with `kosakata,arti` and 20 with `word,translation,notes` list 5 rows; with kosakata and word on Term and arti and translation on Meaning, Import is enabled and all 50 decks import correctly.
- In Import decks, if one file has both `arti` and `terjemahan` and both are on Meaning, "Meaning is chosen for 2 columns in 1 file: <name>. Pick one." shows and Import is disabled.
- In Import decks, when 3 files have no column on Meaning, a line names them and Import is disabled.
- In Import decks, an unreadable file is listed with Remove; Import stays disabled until it is removed.
- In Import decks, after Import the modal closes and the batch's progress shows in the Imports panel, as in FR-29.
- Neither import modal shows "Download template".
- Choosing other files, or closing and reopening the modal, discards earlier matches.

## FR-36 Daily new cards: a target, not a limit (S)

Extends FR-1, FR-7 and FR-17. The setting "New words per day" counts cards, one per word per drill, so a Learner who sets 30 and studies 4 drills meets far fewer than 30 new words and can't tell why. And once the number is used up, no session brings in anything new, even when the Learner wants to keep going. The setting should name what it counts and only track it.

- The setting is renamed **New cards per day**. A card is one word in one drill. Help: "A daily target. Reaching it doesn't stop new cards." An info icon after the label opens a tooltip: "A card is one word in one drill." It opens on hover or keyboard focus, and on tap on a phone; it closes on mouse out, blur, Escape or a tap elsewhere. Range (0 to 200) and saved values are unchanged.
- A card counts toward the day's target on its first review. This is what is counted today; only the name changes.
- The target never limits a session. A session takes the due cards first, then fills the rest with new cards up to the session size, as long as the deck has new cards, below, at or past the target.
- **Study setup** shows one line under the drill choices: "New cards today: 12 of 30". At or past the target it reads "New cards today: 30 of 30 · target reached" ("34 of 30" past it). It is information only.
- Each drill's "N new" in setup counts the deck's new cards in that drill (words with no card in it), whatever the target.
- **Dashboard and notification panel:** same look. Their "new" figure counts the new cards still available, whatever the target, so it matches setup. The headline says "new cards" instead of "new words": "You have 32 cards to review and 10 new cards waiting."
- New cards studied from a snoozed deck count toward the target (FR-20). Hard words sessions hold no new cards and are unchanged.
- **Won't:** any limit on new cards other than the session size, counting words instead of cards, a target per deck or per drill, slowing new cards down when reviews pile up.

**UI:** `docs/design/fr-36.html`

**Acceptance**
- The Settings row reads "New cards per day" with the help text above, word for word, its info icon shows the card tooltip above, word for word, and a saved 30 still shows 30.
- After first reviews of 12 cards today, setup shows "New cards today: 12 of 30".
- With the target at 30, 30 new cards already today, nothing due and a deck with new cards left, a size-20 session holds 20 new cards; afterwards setup shows "New cards today: 50 of 30 · target reached".
- With 5 cards due and 30 new cards already today, a size-20 session holds the 5 due cards and 15 new cards.
- A session is short only when the deck runs out of due and new cards, never because of the target; its notice is unchanged.
- Each drill's "N new" in setup equals the deck's words with no card in that drill, also past the target.
- With 30 new cards already today and 40 new cards left in the Learner's decks, the dashboard's "new" figure shows 40 and its headline says "40 new cards waiting".
- New cards studied from a snoozed deck count toward "New cards today".

## FR-37 Delete account (S)

Extends FR-2, FR-5 and FR-10. A Learner who wants to leave Voca has no way to do it: their name, email and photo stay stored, and their public decks keep showing their name in Community. A Learner can delete their own account. What identifies them is removed, and what other Learners hold stays theirs.

- Settings ends with a **Danger zone** card holding one row: "Delete account", help "Deletes your decks and signs you out everywhere. This can't be undone.", and a danger button "Delete account…".
- The button opens a confirmation, "Delete your account?", subtitle "This can't be undone." It lists what happens, word for word as in the design, and asks the Learner to type their email. "Delete account" stays disabled until the typed text matches the account's email, ignoring spaces around it and letter case. "Keep account", ✕, Escape or a click outside closes it and changes nothing.
- Deleting is immediate and permanent. There is no grace period and no restore.
- Every deck the Learner owns is deleted as a single deck delete does (FR-2): it leaves the library and Community, public decks included.
- The account's name, email, photo and Google link are erased. Study history (review logs) is kept, tied to nothing that identifies the Learner.
- Every token of the account is revoked at once: this tab, other tabs and other devices are signed out, and a still-valid access token is refused.
- This tab lands on the sign-in page with "Your account has been deleted." The notice is gone after a reload.
- Signing in again with the same Google account creates a new, empty account with default settings, as a first sign-in does.
- Forks other Learners made of the deleted Learner's decks keep their words and progress. Their "Forked from" line behaves as it does for any deleted deck.
- If the delete fails, the modal stays open with "Couldn't delete your account. Nothing was deleted. Try again." and the account is unchanged.
- **Won't:** a grace period or undo, an export before deleting (the CSV export idea stays separate), deleting someone else's account, an admin delete screen, keeping public decks alive under a "Deleted learner" name.

**UI:** `docs/design/fr-37.html`

**Acceptance**
- Settings shows the Danger zone card with the label, help and button above, word for word.
- In the confirmation, "Delete account" is disabled with nothing typed and with a partial email, and enabled for the exact email, the email in other letter case, and the email with spaces around it.
- Closing the confirmation any of the four ways leaves the account, its decks and its sign-in unchanged.
- After confirming, the browser shows the sign-in page with "Your account has been deleted."; after a reload the notice is gone.
- After the delete, the account's access token and refresh token both get 401, including an access token issued less than 15 minutes earlier.
- After the delete, none of the account's decks appears in Community or opens by its slug, and a deck another Learner forked from one of them still opens with all its words and progress.
- After the delete, the stored account holds no name, email, photo URL or Google ID, and no API response returns them.
- Signing in again with the same Google account returns a Learner with a new slug, no decks and default settings.
- When the delete fails, the modal shows the failure message, and the account still signs in and owns all its decks.

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
