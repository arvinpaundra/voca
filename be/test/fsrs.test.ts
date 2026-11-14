import { describe, expect, test } from "bun:test"
import { DateTime } from "effect"
import { initialMemory, intervalDays, nextMemory, type Rating, ratingFromAnswer, retrievability } from "../src/study/domain/fsrs.ts"
import { dueAfter, studyDay } from "../src/study/domain/studyDay.ts"
import vectors from "./fixtures/fsrs-vectors.json"

// FSRS-6 with the default parameters, checked against vectors generated once with ts-fsrs
// (short-term scheduling off, fuzz off). ts-fsrs is not a dependency; the JSON is the reference.

const DIGITS = 6

describe("FSRS-6 against the ts-fsrs vectors", () => {
  test.each(vectors.initial)("initial memory for rating $rating", ({ rating, stability, difficulty }) => {
    const memory = initialMemory(rating as Rating)

    expect(memory.stability).toBeCloseTo(stability, DIGITS)
    expect(memory.difficulty).toBeCloseTo(difficulty, DIGITS)
  })

  test.each(vectors.next)(
    "S=$stability D=$difficulty after $elapsedDays days, rating $rating",
    ({ stability, difficulty, elapsedDays, rating, after }) => {
      const memory = nextMemory({ stability, difficulty }, elapsedDays, rating as Rating)

      expect(memory.stability).toBeCloseTo(after.stability, DIGITS)
      expect(memory.difficulty).toBeCloseTo(after.difficulty, DIGITS)
    }
  )

  test.each(vectors.retrievability)("R after $elapsedDays days at S=$stability", ({ elapsedDays, stability, r }) => {
    expect(retrievability(elapsedDays, stability)).toBeCloseTo(r, DIGITS)
  })

  test.each(vectors.interval)(
    "interval at S=$stability, retention $desiredRetention",
    ({ stability, desiredRetention, days }) => {
      expect(intervalDays(stability, desiredRetention)).toBe(days)
    }
  )
})

describe("ratingFromAnswer", () => {
  test.each([
    [false, 1_000, 1],
    [false, 30_000, 1],
    [true, 8_000, 3],
    [true, 8_001, 2],
    [true, 500, 3]
  ] as const)("correct=%p after %d ms rates %d", (correct, latencyMs, rating) => {
    expect(ratingFromAnswer(correct, latencyMs)).toBe(rating)
  })
})

const utc = (iso: string) => DateTime.makeUnsafe(iso)
const iso = (instant: DateTime.Utc) => DateTime.formatIso(instant)

describe("studyDay", () => {
  test.each([
    ["after the day start", "2026-11-14T10:00:00Z", "UTC", 4, "2026-11-14T04:00:00.000Z", "2026-11-15T04:00:00.000Z"],
    ["before the day start: still yesterday", "2026-11-14T03:59:00Z", "UTC", 4, "2026-11-13T04:00:00.000Z", "2026-11-14T04:00:00.000Z"],
    ["Jakarta, +7", "2026-11-14T00:00:00Z", "Asia/Jakarta", 4, "2026-11-13T21:00:00.000Z", "2026-11-14T21:00:00.000Z"],
    ["Kathmandu, +5:45", "2026-11-14T00:00:00Z", "Asia/Kathmandu", 4, "2026-11-13T22:15:00.000Z", "2026-11-14T22:15:00.000Z"],
    ["New York spring-forward: 02:00 doesn't exist, the day ends at 03:00", "2026-03-07T12:00:00Z", "America/New_York", 2, "2026-03-07T07:00:00.000Z", "2026-03-08T07:00:00.000Z"],
    ["New York fall-back: a 25-hour day from the earlier 01:00", "2026-11-01T12:00:00Z", "America/New_York", 1, "2026-11-01T05:00:00.000Z", "2026-11-02T06:00:00.000Z"]
  ])("%s", (_, now, timezone, dayStartHour, start, end) => {
    const day = studyDay(utc(now), timezone, dayStartHour)

    expect(iso(day.start)).toBe(start)
    expect(iso(day.end)).toBe(end)
  })

  test("a due date lands on a study-day start, whatever time the answer was given", () => {
    const day = studyDay(utc("2026-11-14T23:50:00Z"), "UTC", 4)

    expect(iso(dueAfter(day, "UTC", 4, 1))).toBe("2026-11-15T04:00:00.000Z")
    expect(iso(dueAfter(day, "UTC", 4, 30))).toBe("2026-12-14T04:00:00.000Z")
  })

  test("a due date across a DST change keeps the local day start", () => {
    const day = studyDay(utc("2026-10-31T12:00:00Z"), "America/New_York", 4)

    expect(iso(dueAfter(day, "America/New_York", 4, 2))).toBe("2026-11-02T09:00:00.000Z")
  })
})
