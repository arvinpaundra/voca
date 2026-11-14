import { describe, expect, test } from "bun:test";
import { DateTime } from "effect";
import type { DeckSummary } from "@voca/contract";
import { filterDecks, termLangsOf, type DeckFilter } from "./deckList";

// The deck list is loaded whole, so search, the language filter and sorting happen in the browser.

const deck = (slug: string, fields: Partial<DeckSummary>): DeckSummary =>
  ({
    slug,
    title: slug,
    description: "",
    termLang: "ja",
    meaningLang: "en",
    visibility: "private",
    publishedAt: null,
    forkedFrom: null,
    forkCount: 0,
    createdAt: DateTime.makeUnsafe("2026-11-01T00:00:00Z"),
    updatedAt: DateTime.makeUnsafe("2026-11-01T00:00:00Z"),
    wordCount: 0,
    dueCount: 0,
    ...fields
  }) as DeckSummary;

const decks = [
  deck("A", { title: "JLPT N5", termLang: "ja", wordCount: 120, dueCount: 3, updatedAt: DateTime.makeUnsafe("2026-11-10T00:00:00Z") }),
  deck("B", { title: "hsk 1", termLang: "zh-Hans", wordCount: 40, dueCount: 9, updatedAt: DateTime.makeUnsafe("2026-11-12T00:00:00Z") }),
  deck("C", { title: "Kitchen words", termLang: "ja", wordCount: 40, dueCount: 0, updatedAt: DateTime.makeUnsafe("2026-11-05T00:00:00Z") })
];

const all: DeckFilter = { q: "", termLang: null, sort: "recent" };

const slugs = (list: readonly DeckSummary[]): string[] => list.map((d) => String(d.slug));

describe("filterDecks", () => {
  test("recent: the most recently updated first", () => {
    expect(slugs(filterDecks(decks, all))).toEqual(["B", "A", "C"]);
  });

  test("title: A to Z, ignoring case", () => {
    expect(slugs(filterDecks(decks, { ...all, sort: "title" }))).toEqual(["B", "A", "C"]);
  });

  test("words: the most words first, ties by title", () => {
    expect(slugs(filterDecks(decks, { ...all, sort: "words" }))).toEqual(["A", "B", "C"]);
  });

  test("due: the most due first", () => {
    expect(slugs(filterDecks(decks, { ...all, sort: "due" }))).toEqual(["B", "A", "C"]);
  });

  test("the search matches part of the title, ignoring case and surrounding spaces", () => {
    expect(slugs(filterDecks(decks, { ...all, q: "  KITCHEN " }))).toEqual(["C"]);
    expect(slugs(filterDecks(decks, { ...all, q: "n5" }))).toEqual(["A"]);
    expect(filterDecks(decks, { ...all, q: "nothing" })).toEqual([]);
  });

  test("the language filter keeps decks with that term language", () => {
    expect(slugs(filterDecks(decks, { ...all, termLang: "ja" }))).toEqual(["A", "C"]);
    expect(slugs(filterDecks(decks, { ...all, termLang: "ja", q: "jlpt" }))).toEqual(["A"]);
  });

  test("leaves its input untouched", () => {
    filterDecks(decks, { ...all, sort: "title" });

    expect(slugs(decks)).toEqual(["A", "B", "C"]);
  });
});

describe("termLangsOf", () => {
  test("each term language once, sorted", () => {
    expect(termLangsOf(decks)).toEqual(["ja", "zh-Hans"]);
    expect(termLangsOf([])).toEqual([]);
  });
});
