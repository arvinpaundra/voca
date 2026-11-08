# 05 — Study Sessions, Retry-Until-Correct, Hard Mode & Sound

## Vocabulary
- **Session word:** one of the `size` distinct Words chosen for a session.
- **Question (attempt):** one showing of a session word, with 4 Options. Attempt 1 is the first showing, and attempts 2 and later are **retries**.
- A session word is **cleared** once one of its attempts is answered correctly.
- A Session is **completed** once every session word is cleared.

## FR-13 (revised): picked once, retried until correct

1. **Picked once:** a Word is selected at most once per session. The `size` session words are distinct.
2. **Cleared words never return:** once a word is answered correctly, no more questions are created for it in this session.
3. **Wrong words return until correct:** each wrong answer creates the next attempt for that word, with freshly picked and freshly shuffled options. The client shows it **3 questions later**, or next if fewer than 3 remain. The gap keeps the answer from still sitting in working memory.
4. **One pending at a time:** a word never has two unanswered attempts. The database enforces this with a partial unique index.

**Termination:** after every wrong answer the client reveals the correct meaning, and there are only 4 options, so a learner always gets there eventually. There is no attempt cap. The Learner can **end the session** at any time; uncleared words have already been rescheduled by their first attempt.

## Scheduling: only the first attempt counts

| Attempt | FSRS effect | Logged in |
|---|---|---|
| 1 | `rating = ratingFromAnswer(correct, latency)` → `schedule(card)`, `INSERT reviews` | `reviews` + `session_questions` |
| ≥ 2 (retry) | **None.** The card's due date, stability, and difficulty are untouched | `session_questions` only |

Reasoning:
- A wrong first answer is already a lapse (`Again`), and the next due date is at least the next study day.
- Retries happen seconds later. Rating them as well would count one forgetting event several times.
- Retries are still kept, because they feed the **attempts-to-correct** and **confused with** metrics ([10](10-analytics.md)).
- This matches FSRS when same-day reviews are disabled ([04](04-scheduling.md)).

## Session lifecycle

```
POST /sessions {scope, drills: DrillId[1..4], size, mode}
  ├─ 1. abandon the Learner's active Session (if any)
  ├─ 2. due  = Cards in scope with c.drill ∈ drills, due < studyDay.end;
  │            one card per word (its most overdue), most overdue words first, LIMIT size
  ├─ 3. new  = if |due| < size: round-robin over drills, words where applies(drill), no card in that
  │            drill, not already picked (anti-join, see 06); LIMIT min(size−|due|, newLeftToday)
  ├─ 4. order = shuffle(due ++ new)                     (seeded Random → directions interleave)
  ├─ 5. for each (word, drill): attempt 1, prompt = word[drill.prompt],
  │        options = word + pickDistractors(word, pool(deck, drill), drill, mode), shown as word[drill.answer]
  └─ 6. INSERT session + questions (one transaction)
        → 201 Session { slug: "G7PX2MQ9VB4KR8", questions: [pending questions in position order] }

POST /sessions/:sessionSlug/answers {position, chosenWordSlug, latencyMs}       (one transaction)
  ├─ lock question row; verify session active ∧ owned ∧ question unanswered ∧ chosen ∈ options
  ├─ correct = chosen == question.word
  ├─ UPDATE question SET answered_at, chosen_word_id, correct, latency_ms
  ├─ if attempt = 1: card = (word, question.drill) FOR UPDATE
  │                    none → INSERT card(initial(rating)); else card' = schedule(card, rating, now); UPDATE
  │                    INSERT review (drill, state_before = new | review)
  ├─ if ¬correct:    INSERT attempt+1 (position = max+1, fresh options)  → retry
  ├─ if no pending questions remain → session.status = 'completed'
  └─ 200 { correct, correctWordSlug, nextDue | null (attempt 1 only), retry: Question | null,
           completed: boolean, leech: boolean }
```

- **Ordering is the client's job.** The server enforces the invariants. The client keeps a queue: it shows the questions in position order and inserts a `retry` 3 slots after the current one. When a session is resumed (`GET /sessions/active`), the pending questions come back in position order.
- **Progress** is shown as `cleared / size`. The total number of questions can exceed `size`.
- The correct answer is **never** in the question payload; it is only revealed in the answer response.

## Distractors

Distractors are defined **per drill**: options are values of the drill's answer Field, deduplicated by `answerKey`. Hard mode compares the non-meaning side. The rules below are written for `term_meaning`; the generalization is in [14](14-drills.md).

### Shared rules (both modes, every attempt)
- The pool is the Words of the **prompt's own Deck**. For the `hard` scope, each prompt uses its own deck's pool.
- Remove from the pool:
  - the prompt itself
  - any Word with the same `meaningKey` as the prompt
  - duplicate `meaningKey`s among the candidates
- If fewer than 3 candidates remain, the request fails with `422 DeckTooSmall`.
- **Retries get new options**, and the correct option moves to a new random slot. Otherwise the learner could memorize "it's the 2nd button" instead of the word.

### Easy mode
Pick 3 candidates uniformly at random (seeded `Random`).

### Hard mode: similarity

```ts
// study/domain/similarity.ts
similarity(a, b) = max(
  orthographic(a.termKey,  b.termKey),     // 1 − levenshtein / maxLen, measured in graphemes
  phonetic(a.readingKey, b.readingKey),    // same as above, on readings; 0 if either reading is missing
)
```

| Signal | Catches | Example |
|---|---|---|
| Orthographic (grapheme Levenshtein) | Look-alike spelling, shared characters | `生活 / 生命` (0.5), `affect / effect` (0.83) |
| Phonetic (reading Levenshtein) | Homophones that look different | `橋 はし / 箸 はし` (1.0), `shì 是 / shí 十` |

- **Graphemes** come from `Intl.Segmenter` (built in).
- **Reading normalization:** NFKD, then remove combining marks (`shì → shi`), then case-fold. Katakana is folded to hiragana (code points U+30A1–U+30F6 minus 0x60).
- **Picking:** rank the pool by similarity, take the top 6, and choose 3 at random. If fewer than 3 have `similarity > 0`, fill the rest randomly.
- **Cost:** about 10 ms for a 2,000-word deck and 20 prompts, and about 150 ms at the 20k-word cap. A retry scores a single prompt.
- `ponytail:` on-the-fly scoring. Precompute a `word_neighbors` top-10 table when words are written if the p95 time to create a session exceeds 200 ms.

## Sound effects (FR-14)

The sounds are synthesized with the **Web Audio API**: no audio files, no dependency, about 50 lines in `fe/src/features/study/sfx.ts`.

| Event | Sound | Recipe |
|---|---|---|
| `start` | Session begins | Sine, 440 Hz → 660 Hz glide, 120 ms |
| `select` | Option tapped | Sine, 880 Hz, 30 ms (subtle tick) |
| `correct` | Answer correct | Triangle, two notes C6 then G6 (1047 Hz → 1568 Hz), 80 ms each |
| `wrong` | Answer wrong | Square through a lowpass at 1.2 kHz, 220 Hz → 147 Hz, 220 ms, gain 0.15 |
| `retry` | A retried word reappears | Sine, 523 Hz, two 40 ms blips |
| `complete` | Session completed | Triangle arpeggio C5–E5–G5–C6, 90 ms per note |

Implementation rules:
- **One `AudioContext`** for the whole app, created lazily and resumed inside the first user gesture (the "Start session" click). Browsers block audio before a gesture.
- **Every note** uses a `GainNode` envelope (5 ms attack, exponential release to 0.0001). Cutting a note off abruptly causes audible clicks.
- **Mute toggle** in the session header. The setting is stored in `localStorage` (`voca.sfx`) because it is a per-device preference, so no server setting is needed. It defaults to on.
- **Sound is supplementary.** Every event also has a visual and text cue (color, icon, an `aria-live` message), so muted users and screen-reader users lose nothing.
- If the Web Audio API is unavailable (`!window.AudioContext`), every sound call does nothing.

Example:

```ts
// fe/src/features/study/sfx.ts (shape)
let ctx: AudioContext | undefined
const tone = (freq: number, at: number, dur: number, type: OscillatorType = "sine", vol = 0.2) => { /* osc → gain envelope → destination */ }
export const sfx = {
  correct: () => play(t => { tone(1047, t, 0.08, "triangle"); tone(1568, t + 0.08, 0.08, "triangle") }),
  // …
}
```
