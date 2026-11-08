# 04 — Scheduling (FSRS-6) & Time

## Why FSRS rather than SM-2

SM-2 (classic Anki, SuperMemo 2) uses a fixed ease multiplier. FSRS is a three-component memory model:

- **D**ifficulty
- **S**tability
- **R**etrievability

It was fitted on hundreds of millions of real reviews. Benchmarks show it needs about 20–30% fewer reviews for the same retention, and Anki has shipped it since version 23.10. The formulas are small, and owning the code keeps the core domain pure, testable, and free of dependencies.

## Model (FSRS-6, default parameters)

```
w = [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666,
     0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542]
G ∈ {1=Again, 2=Hard, 3=Good, 4=Easy}
```

| Quantity | Formula |
|---|---|
| Forgetting curve | `R(t,S) = (1 + F·t/S)^(−w20)`, where `F = 0.9^(−1/w20) − 1` (so `R(S,S) = 0.9`) |
| Next interval | `I(r,S) = S/F · (r^(−1/w20) − 1)`, rounded and clamped to `[1, maxInterval]` days |
| Initial stability | `S0(G) = w[G−1]` |
| Initial difficulty | `D0(G) = w4 − e^(w5·(G−1)) + 1`, clamped to `[1,10]` |
| Difficulty update | `ΔD = −w6·(G−3)`; `D' = D + ΔD·(10−D)/9`; `D'' = w7·D0(4) + (1−w7)·D'`, clamped to `[1,10]` |
| Stability after success (G≥2) | `S' = S·(1 + e^w8·(11−D)·S^(−w9)·(e^(w10·(1−R)) − 1)·hp·eb)`, where `hp = w15` if G=2 (else 1) and `eb = w16` if G=4 (else 1) |
| Stability after lapse (G=1) | `S' = min(S, w11·D^(−w12)·((S+1)^w13 − 1)·e^(w14·(1−R)))` |

- `r` = the Learner's `desiredRetention` (default 0.90).
- `maxInterval` = 36500 days.
- **Same-day reviews (w17–w19) are not used.** Only the first attempt at a word in a session is rated. Retries until correct (FR-13) are practice and are not fed to FSRS. Every interval is at least 1 study day, so a Card is never scheduled twice on the same day.

**Verification:** the parameter values and formulas match the FSRS-6 reference ([awesome-fsrs wiki](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm)). Golden test vectors are generated **once** with `ts-fsrs` (`enable_short_term: false`, fuzz off) and committed as JSON. `ts-fsrs` is not a dependency. See [11](11-testing.md).

**Fuzz:** intervals of 3 days or more get ±5% fuzz, so Cards imported together don't all fall due on the same day. The seed is `hash(cardId, reps)`, which keeps the result deterministic and testable.

## From answer to Rating

The app uses multiple choice, so Learners never grade themselves. The rating is derived from the answer:

```ts
// study/domain/rating.ts
const SLOW_MS = 8_000 // ponytail: fixed threshold; per-Learner median latency if users complain
export const ratingFromAnswer = (correct: boolean, latencyMs: number): Rating =>
  !correct ? Rating.Again : latencyMs > SLOW_MS ? Rating.Hard : Rating.Good
```

- `Easy` is never produced automatically. Recognizing the answer from 4 options is easier than recalling it unprompted, so an automatic `Easy` would inflate stability.
- If Learners find intervals too short, they can **lower** `desiredRetention`. That setting already exists, so no new rating is needed.
- `latencyMs` is measured on the client (`performance.now()` from when the options render to when one is clicked). The server clamps it to `[0, 120000]`.

## Card state transitions

A Card is one `(word, drill)` pair ([14](14-drills.md)), and it is created by its first answer:

```
  (no card)  ── first answer G ──▶  INSERT card  S = S0(G), D = D0(G)          "new" = no row
                                        │
                answer(G≥2) → S' = success(S,D,R,G), D' = update(D,G)
                answer(G=1) → S' = lapse(S,D,R), lapses += 1   (due ≥ next study day)
                                        │
                                   UPDATE card  ◀── every later rated answer
```

A card that exists has been reviewed, so there is no `new` state and the memory fields are never null. In-session retries play the role of Anki's learning steps, but they live in the Session, not the Card. Each drill keeps its own memory: a lapse in *Pinyin → Hanzi* does not touch *Hanzi → Meaning*.

## Time & timezone (FR-9)

### Storage
- Every instant is a `timestamptz` (UTC). The app never stores a local date.
- Each Learner has `timezone` (an IANA name such as `Asia/Jakarta`) and `dayStartHour` (0–23, default 4).

### Study day
```
studyDayBounds(now, tz, h):
  local      = now in tz
  dayStart   = local.date at h:00 (if local.hour < h → previous date at h:00)
  return { start: dayStart (as instant), end: dayStart + 1 calendar day in tz (as instant) }
```
This is built with Effect `DateTime.makeZoned` and `DateTime.add({ days: 1 })` on a zoned value, which is DST-aware. As a result, a study day can be 23 h or 25 h long.

### Due instant
```
due = (studyDay.start + intervalDays calendar days in tz)   // lands exactly on a day boundary
```
- A Card becomes due **at the start of a study day**, not at the exact time of day it was answered. A word answered at 23:50 with an interval of 1 day is due at 04:00 the next day, not at 23:50.
- "Due now" means `due ≤ now`. The notification panel and session builder use `due < studyDay.end`, so everything due today counts.
- **Elapsed time for R** is measured as real time: `t = (now − lastReview) / 86_400_000` (fractional days).

### Edge cases (each covered by integration tests)
| Case | Behavior |
|---|---|
| DST spring-forward in America/New_York, `dayStartHour = 2` | 02:00 does not exist that day, so it resolves to 03:00 (`disambiguation: "compatible"`) |
| DST fall-back | 01:00 occurs twice, so the earlier occurrence is used. The study day is 25 h |
| Half-hour and quarter-hour offsets (Asia/Kathmandu +5:45, Pacific/Chatham +12:45) | Correct because the code never does offset arithmetic by hand |
| Learner moves Jakarta → Tokyo | Stored `due` instants are unchanged. Cards due at 04:00 WIB become due at 06:00 JST. This is acceptable: the change lasts one day and nothing is lost |
| Invalid timezone from the browser | Rejected at the boundary by a Schema that checks `Intl.supportedValuesOf("timeZone")`, so the stored value stays valid |
