import { describe, expect, test } from "bun:test";
import { DateTime } from "effect";
import type { WordCard, WordWithCards } from "@voca/contract";
import { matchesWordFilter } from "./wordFilter";

// A word has one Card per drill it was studied in, so the deck page filters on what is true of the word as a whole.
// Due dates fall on study-day starts, so "due today" is a Card due at or before now.

const now = DateTime.makeUnsafe("2026-11-14T00:00:00Z");

const card = (due: string, isHard = false): WordCard =>
  ({ drill: "term_meaning", due: DateTime.makeUnsafe(due), stabilityDays: 5, isHard }) as WordCard;

const word = (cards: readonly WordCard[]): WordWithCards =>
  ({
    slug: "W00000000001",
    term: "猫",
    reading: "ねこ",
    meaning: "cat",
    example: null,
    notes: null,
    createdAt: DateTime.makeUnsafe("2026-11-01T00:00:00Z"),
    cards
  }) as WordWithCards;

const unstudied = word([]);
const dueNow = word([card("2026-11-15T04:00:00Z"), card("2026-11-13T04:00:00Z")]);
const dueExactlyNow = word([card("2026-11-14T00:00:00Z")]);
const later = word([card("2026-11-14T04:00:00Z")]);
const hardLater = word([card("2026-11-14T04:00:00Z"), card("2026-11-20T04:00:00Z", true)]);

describe("matchesWordFilter", () => {
  test("all: every word", () => {
    for (const w of [unstudied, dueNow, later, hardLater]) expect(matchesWordFilter(w, "all", now)).toBe(true);
  });

  test("due: any Card due at or before now", () => {
    expect(matchesWordFilter(dueNow, "due", now)).toBe(true);
    expect(matchesWordFilter(dueExactlyNow, "due", now)).toBe(true);
    expect(matchesWordFilter(later, "due", now)).toBe(false);
    expect(matchesWordFilter(unstudied, "due", now)).toBe(false);
  });

  test("new: no Card at all", () => {
    expect(matchesWordFilter(unstudied, "new", now)).toBe(true);
    expect(matchesWordFilter(later, "new", now)).toBe(false);
  });

  test("hard: any Card marked hard", () => {
    expect(matchesWordFilter(hardLater, "hard", now)).toBe(true);
    expect(matchesWordFilter(dueNow, "hard", now)).toBe(false);
    expect(matchesWordFilter(unstudied, "hard", now)).toBe(false);
  });
});
