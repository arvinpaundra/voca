import { expect, test } from "bun:test";
import { dayLabel } from "./dateLabel";

// The label is joined from parts on purpose: en-GB's short pattern puts a comma after the weekday in some ICU
// builds, so taking the formatted string made the same code read differently on CI (Linux) and on macOS.

test.each([
  ["2026-11-19", "Thu 19 Nov"],
  ["2026-01-01", "Thu 1 Jan"],
])("%s reads as %s", (date, label) => {
  expect(dayLabel(date)).toBe(label);
});

test.each([
  ["2026-11-19", "Thu 19 Nov 2026"],
  ["2026-01-01", "Thu 1 Jan 2026"],
])("%s with the year reads as %s", (date, label) => {
  expect(dayLabel(date, true)).toBe(label);
});

test("no comma survives, whichever ICU build formats it", () => {
  expect(dayLabel("2026-11-19", true)).not.toContain(",");
});
