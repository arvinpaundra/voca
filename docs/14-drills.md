# 14 — Drills (Question Directions)

A session is no longer only "term → meaning". Before starting, the Learner picks **one or more Drills**, so a session can mix directions. A **Drill** is a direction made of a **prompt field** (what is shown) and an **answer field** (what is chosen from 4 options).

## Fields: three, with no romanization

A Word has `term`, an optional `reading`, and `meaning`. **What `reading` holds depends on the language.** Nothing is forced into Latin script, and nothing is derived.

| Language | `term` | `reading` | Example |
|---|---|---|---|
| **ja**: kanji word | Kanji (+ okurigana) | Hiragana | 食べる · たべる · to eat |
| **ja**: katakana word | Katakana | Hiragana | コーヒー · こーひー · coffee |
| **ja**: hiragana-only word | Hiragana | *(empty)* | ありがとう · — · thank you |
| **zh** | Hanzi | Pinyin (with tone marks) | 学习 · xuéxí · to study |
| **yue** | Hanzi | Jyutping | 學習 · hok6 zaap6 · to study |
| **others** | Word | *(optional, any pronunciation aid)* | hola · — · hello |

Japanese `reading` is always **hiragana**, whether the term is kanji or katakana. A hiragana-only word is already its own reading, so it leaves `reading` empty.

## Drills: four, the same for every language

| DrillId | Prompt → Answer | Applies when |
|---|---|---|
| `term_meaning` | term → meaning | always |
| `meaning_term` | meaning → term | always |
| `term_reading` | term → reading | the word has a reading that differs from its term |
| `reading_term` | reading → term | the same as above |

The **Language Profile** (by primary subtag of `termLang`) supplies only **labels**. It is data, not logic:

| Profile | term label | reading label | Drills shown as |
|---|---|---|---|
| **ja** | Word | Hiragana | Word → Meaning · Meaning → Word · Word → Hiragana · Hiragana → Word |
| **zh** | Hanzi | Pinyin | Hanzi → Meaning · Meaning → Hanzi · Hanzi → Pinyin · Pinyin → Hanzi |
| **yue** | Hanzi | Jyutping | … · Hanzi → Jyutping · Jyutping → Hanzi |
| **default** | Word | Reading | Word → Meaning · Meaning → Word · (reading drills only if words have readings) |

For ja, the term label is "Word" because a term can be kanji (食べる) or katakana (コーヒー). Both take part in the reading drills: 食べる → たべる and コーヒー → こーひー. Hiragana-only words appear only in the meaning drills.

```ts
// study/domain/drill.ts
type Field = "term" | "reading" | "meaning"
type DrillId = "term_meaning" | "meaning_term" | "term_reading" | "reading_term"
const DRILLS: Record<DrillId, { prompt: Field; answer: Field }> = { … }
const applies = (d: DrillId, w: Word) =>
  d.endsWith("meaning") || d.startsWith("meaning") ? true : w.readingKey !== "" && w.readingKey !== w.termKey
```

In SQL, the applicability check for the two reading drills is `reading_key <> '' AND reading_key <> term_key`. `normalizeKey` does not fold katakana into hiragana, so コーヒー / こーひー count as different and the reading drills apply.

## Scheduling: one Card per (Word, Drill)

Each drill is a separate skill, so each `(word, drill)` pair has its **own Card** with its own FSRS memory. Knowing 食べる → "to eat" does not mean you can pick 食べる from たべる.

- **Cards are created lazily**, on the first answer to that `(word, drill)`. A word without a card in a drill is **new in that drill**. This means:
  - There are no rows for drills a Learner never uses.
  - Adding a reading to a word later needs no backfill.
  - The Card has no `new` state. If it exists, it has been reviewed, and its memory fields are always set.
- **The daily new limit (`newPerDay`) is shared across drills.** It counts first-ever reviews (`reviews.state_before = 'new'`) during the study day.
- **Hard Words and leeches are per card.** Marking a word hard in *Pinyin → Hanzi* flags only that drill. The word page shows one toggle per drill the Learner has already studied.

## Session setup (FR-17)

```
Deck: 日本語 N5 Verbs
Drills [x] Word → Meaning    · 24 due · 20 new     ← multi-select, at least one;
       [x] Meaning → Word    ·  3 due · 20 new        default: last set used for this deck
       [ ] Word → Hiragana   ·  0 due · 20 new
       [x] Hiragana → Word   ·  0 due · 20 new
Words  [7] [10] [15] [20]
Mode   [Easy] [Hard]
       [ Start session ]
```

- The list comes from `GET /decks/:deckSlug/drills`. It contains only drills that apply to at least one word, each with today's due and new counts. A deck where no word has a reading only shows the two meaning drills.
- **Mixed sessions:** the Learner picks any non-empty subset of the listed drills. Each question carries its own drill, and the study screen shows the direction label (for example "Hiragana → Word") above every prompt, because the kind of question can change from one item to the next.
- **A word appears in only one drill per session.** If 食べる → "to eat" is asked first, a later たべる → 食べる question would already have its answer revealed. This keeps FR-13's "picked once" rule per word, not per card.
- **Selection** (given the selected drills D):
  1. **Due:** cards with `drill ∈ D` and `due < studyDay.end`. When a word has several due cards, keep only its most overdue one (`DISTINCT ON (word_id) … ORDER BY word_id, due`). Then take the most overdue words first, up to `size`.
  2. **New:** fill the rest round-robin across D, taking the oldest applicable word that has no card in that drill and isn't already in the session. The daily new limit still applies.
  3. **Shuffle** the result, so directions are interleaved.
- **A retry keeps its question's drill.**
- The last selected set is remembered per deck in `localStorage` (`voca.drills.<deckSlug>`), as a per-device preference.
- **Hard-words scope:** the Learner also picks a set of drills. All 4 drill IDs are the same in every language, so a hard-words session can mix decks. Each prompt still uses its own deck's labels and pool.

## Questions & distractors per drill

- **Prompt** = the word's `drill.prompt` field. **Options** = the `drill.answer` values: the correct word's value plus 3 distractors.
- **Pool:** words in the same deck for which the drill applies.
- **No two options can be the same answer.** Options are deduplicated by `answerKey` (the normalized answer). For example:
  - In *Word → Hiragana*, 箸 and 橋 both answer はし, so neither can be a distractor for the other.
  - In *Hiragana → Word*, the reading はし accepts only one of them: whichever word the question is for.
  - Pinyin keeps tone marks in `answerKey`, so `shì` and `shí` are different answers.
- **Hard mode compares the non-meaning side:**
  - If the answer is `meaning`, it compares the prompts: look-alike or sound-alike terms.
  - Otherwise it compares the answers:
    - similar hiragana (はし / はじ / ほし)
    - similar pinyin (`shì` / `shí` / `sì`; tones are stripped for the similarity score only)
    - look-alike kanji or hanzi (生活 / 生命)
  - It uses the same `similarity` function as before ([05](05-study-sessions.md)).
- **Rendering:**
  - Term, hiragana, and hanzi text uses the term font with `lang = termLang`.
  - Pinyin and jyutping use `lang = zh-Latn-pinyin` and `yue-Latn-jyutping`, so screen readers handle them properly.
  - In `term_meaning`, the reading is shown as ruby above the term.
  - In `term_reading` it is hidden, because it is the answer.

## Examples

| Drill | Prompt | Options (✓ = correct) |
|---|---|---|
| ja `term_meaning` | **コーヒー** | ✓ coffee · copy · cocoa · hotel |
| ja `term_reading` | **コーヒー** | ✓ こーひー · こぴー · ここあ · ほてる |
| ja `term_reading` | **箸** | ✓ はし · はな · ほし · さら (はし from 橋 is excluded as a duplicate answer) |
| ja `reading_term` | **たべる** | ✓ 食べる · 調べる · 並べる · 比べる |
| zh `term_reading` | **是** | ✓ shì · shí · sì · zhǐ |
| zh `reading_term` | **xuéxí** | ✓ 学习 · 学校 · 休息 · 学生 |
