import { describe, expect, test } from "bun:test";
import { DateTime } from "effect";
import { shiftMonth, streakMessage, studyDate } from "./dashboardModel";

// The dashboard follows the Learner's study day (timezone and day start hour), the same way the server buckets reviews.

describe("studyDate", () => {
  test("after the day start hour: today's local date", () => {
    expect(studyDate(DateTime.makeUnsafe("2026-11-14T10:00:00Z"), "UTC", 4)).toBe("2026-11-14");
  });

  test("before the day start hour: the previous date", () => {
    expect(studyDate(DateTime.makeUnsafe("2026-11-14T03:59:00Z"), "UTC", 4)).toBe("2026-11-13");
    expect(studyDate(DateTime.makeUnsafe("2026-12-01T01:00:00Z"), "UTC", 4)).toBe("2026-11-30");
  });

  test("uses the local time in the Learner's timezone", () => {
    // 22:00Z is 05:00 the next day in Jakarta (UTC+7).
    expect(studyDate(DateTime.makeUnsafe("2026-11-13T22:00:00Z"), "Asia/Jakarta", 4)).toBe("2026-11-14");
    // 20:00Z is 03:00 the next day in Jakarta: still the study day of the 13th.
    expect(studyDate(DateTime.makeUnsafe("2026-11-13T20:00:00Z"), "Asia/Jakarta", 4)).toBe("2026-11-13");
  });

  test("a day start hour of 0 is plain midnight", () => {
    expect(studyDate(DateTime.makeUnsafe("2026-01-01T00:00:00Z"), "UTC", 0)).toBe("2026-01-01");
  });
});

describe("shiftMonth", () => {
  test("moves across year boundaries", () => {
    expect(shiftMonth("2026-11", -1)).toBe("2026-10");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-03", -14)).toBe("2025-01");
    expect(shiftMonth("2026-03", 0)).toBe("2026-03");
  });
});

describe("streakMessage", () => {
  test("no streak yet", () => {
    expect(streakMessage({ days: 0, studiedToday: false })).toBe("Study today to start a streak");
  });

  test("studied today: the streak is safe", () => {
    expect(streakMessage({ days: 1, studiedToday: true })).toBe("1-day streak. See you tomorrow");
    expect(streakMessage({ days: 12, studiedToday: true })).toBe("12-day streak. See you tomorrow");
  });

  test("not studied yet today: a nudge", () => {
    expect(streakMessage({ days: 1, studiedToday: false })).toBe("Study today to keep your 1-day streak");
    expect(streakMessage({ days: 12, studiedToday: false })).toBe("Study today to keep your 12-day streak");
  });
});
