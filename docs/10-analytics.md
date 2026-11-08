# 10 — Analytics & Notifications

## Research: which per-word metrics matter

Sources: the FSRS memory model (DSR) and Anki's card info and stats screens. Metrics were chosen by asking "does this change what the learner does next?". The recommended set is below.

| Metric | Definition | Why a learner cares |
|---|---|---|
| **Recall probability now** | `R(t, S)` from [04](04-scheduling.md), using `t` = days since `last_review` | "How likely am I to remember this right now?" The single most intuitive number |
| **Stability** | `cards.stability`, in days | Memory strength: the time until recall drops to 90%. It grows with each successful review |
| **Difficulty** | `cards.difficulty` (1–10), shown as Easy / Medium / Hard bands | Shows which words are intrinsically hard for this learner |
| **Maturity** | `new` (never reviewed) · `learning` (S < 21 d) · `mature` (S ≥ 21 d) | Anki's long-term retention milestone; also used for deck progress bars |
| **Reviews / Lapses** | `cards.reps`, `cards.lapses` | Effort spent, and how often the word was forgotten |
| **Accuracy** | `count(correct) / count(*)` over reviews, overall and over the last 10 | The overall rate can hide recent improvement, so both are shown |
| **Current streak** | Number of consecutive correct reviews, counting back from the latest | Motivation; it resets on a lapse |
| **Average answer time** | Median `latency_ms` over the last 10 reviews | Fluency: a correct but slow answer means the word is not automatic yet |
| **Next due / current interval** | `cards.due` (shown in the Learner's timezone), `scheduled_days` of the last review | "When will I see it again?" |
| **First seen / last reviewed** | min and max `reviewed_at` | Context |
| **Leech** | `lapses ≥ 4` | Feeds the Hard Words suggestion (FR-8) |
| **Confused with** | Top 3 `chosen_word_id` values across **all wrong attempts** (`session_questions`, retries included), with counts and terms | Shows *which* words the learner mixes up. Unique to multiple choice, and very actionable |
| **Attempts to correct** | Average attempts until the word is Cleared, over its last 10 sessions (1.0 means it was always right the first time) | Shows how stubborn a word is within a session, separately from long-term forgetting |
| **Easy vs. hard-mode accuracy** | Accuracy grouped by `mode` | Shows whether the learner truly knows the word or only recognizes it among unlike options |
| **History** | A timeline of `{reviewed_at, correct, rating, latency_ms, R predicted, interval}` | Shows where the word was forgotten and how stability grew |

Considered and dropped (YAGNI for the MVP):
- **Calibration** (predicted R vs. actual outcome): meaningful only in aggregate. It is kept at the deck level.
- **Per-word time spent:** redundant with latency.
- **Ease factor:** an SM-2 concept that does not apply to FSRS.

### Response shape

```ts
WordStats = {
  wordSlug, term, reading, meaning,
  maturity: "new" | "learning" | "mature",
  recallNow: number | null, stabilityDays: number | null, difficulty: number | null,
  reps, lapses, leech: boolean, isHard: boolean,
  accuracy: { overall: number | null, last10: number | null, easy: number | null, hard: number | null },
  streak: number, medianLatencyMs: number | null, attemptsToCorrect: number | null,
  nextDue: string | null, intervalDays: number | null,
  firstSeen: string | null, lastReviewed: string | null,
  confusedWith: ReadonlyArray<{ wordSlug, term, count }>,
  history: ReadonlyArray<{ at, correct, rating, latencyMs, predictedRecall, intervalDays }>  // last 50
}
```

Accuracy, streak, history, and latency come from `reviews`, which holds first attempts only, so they measure real recall. "Confused with" and attempts-to-correct come from `session_questions`. This takes one card row plus two index range scans on `word_id`. Aggregation happens in SQL and recall-now is computed in the domain. It costs about 1 ms, and nothing is materialized.

**Per drill.** Every metric above belongs to one Card, which is one `(word, drill)` pair. The word page shows a tab for each drill the word has been studied in, such as *Word → Meaning* and *Word → Hiragana*. Drills the word has not been studied in show "new". Queries add `AND drill = $d`, which is covered by the `(word_id, drill, reviewed_at)` index.

## Deck stats

| Metric | Definition |
|---|---|
| Counts by maturity | `new / learning / mature` |
| Due today, overdue | Overdue means `due < studyDay.start` |
| Forecast | Number of cards due in each of the next 7 study days, bucketed in the Learner's timezone |
| True retention (30 days) | Correct share of reviews where `state_before = 'review'`. It shows whether the target retention is being met |
| Calibration (30 days) | Average predicted `retrievability` vs. actual correct share for the same reviews. If the gap exceeds 5 points, MCQ inflation is happening and lowering retention helps |
| Reviews per day (30 days) | For a sparkline |

## Study activity heatmap (FR-18)

One month per request: one grouped query over the `(learner_id, reviewed_at)` index. Each review is shifted into its study day, so days match the scheduler's:

```sql
SELECT ((reviewed_at AT TIME ZONE $tz) - make_interval(hours => $dayStartHour))::date AS day,
       count(*) AS reviews
FROM reviews
WHERE learner_id = $learner
  AND reviewed_at >= $from          -- studyDayBounds(first day of month).start
  AND reviewed_at <  $to            -- studyDayBounds(last day of month).end
GROUP BY day
ORDER BY day;
```

- **What counts:** rows in `reviews`, which holds first attempts only. Retries are not activity, so 10 words studied is 10 no matter how many retries it took.
- **Month navigation:** the current month is the month of today's study day in the Learner's timezone. The frontend disables **›** on it and **‹** on the month of `learner.createdAt` (from `/me`), so no extra request is needed to know the bounds. `?month` in the future returns an empty list instead of an error.
- **Sparse response:** only days with reviews are sent. The frontend lays out the calendar, fills the gaps with 0, and draws days after today as outlines.
- **Shading** is done on the frontend: level 0 for no reviews, then levels 1–4 split at the 25th, 50th and 75th percentiles of that month's non-zero days.
- **Timezone changes** re-bucket history with the current timezone. Accepted: it moves at most a few hours' worth of reviews across a day boundary.
- **Cost:** at most 31 days of rows. A heavy learner (200 reviews a day) has about 6k rows a month, a few milliseconds. Nothing is materialized.

## Notifications (FR-7)

The panel is computed on request with one query. There is no stored notification table.

```sql
SELECT d.id, d.title,
       count(*) FILTER (WHERE c.due <  $dayEnd)   AS due,
       count(*) FILTER (WHERE c.due <  $dayStart) AS overdue,
       count(*) FILTER (WHERE c.is_hard AND c.due < $dayEnd) AS hard_due
FROM cards c JOIN words w ON w.id = c.word_id JOIN decks d ON d.id = w.deck_id
WHERE c.learner_id = $learner AND c.due < $dayEnd
  AND c.deleted_at IS NULL                  -- matches the partial index; deleted decks soft-delete their cards
GROUP BY d.id, d.title           -- byDrill: the same query grouped by (d.id, c.drill)
ORDER BY overdue DESC, due DESC;
```

The `newAvailable` count is `newPerDay − newDoneToday`, where new-done counts today's reviews with `state_before = 'new'` across all drills. The per-drill new counts on the setup screen come from `/decks/:deckSlug/drills`.

**Frontend:** a TanStack Query with `refetchOnWindowFocus: true` and `refetchInterval: 5 min`. The badge shows the total due. The panel is a native `<dialog>`, and each row links to `/study?deck=…`.

Web push, email, and service workers are not included (YAGNI). Add them if retention data shows that learners forget to come back.
