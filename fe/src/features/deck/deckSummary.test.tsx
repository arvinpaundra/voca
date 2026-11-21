import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { DateTime } from "effect";
import type { Deck, DeckStats, HardWord, Word, WordWithCards } from "@voca/contract";
import { HardWordList } from "../hard/HardWordList";
import { WordHero } from "../word/WordHero";
import { DeckProgress } from "./DeckProgress";
import { WordList } from "./WordList";

// The deck summary carries the forecast and true retention the stats endpoint already returns (FR-6),
// and every reading is written in its own script: pinyin and jyutping are Latin, hiragana is Japanese.

const NOW = DateTime.makeUnsafe("2026-11-18T12:00:00.000Z");

const stats = (overrides: Partial<Record<keyof DeckStats, unknown>> = {}) =>
  ({
    maturity: { new: 12, learning: 30, mature: 8 },
    dueToday: 14,
    overdue: 3,
    forecast: [
      { date: "2026-11-18", count: 14 },
      { date: "2026-11-19", count: 6 },
      { date: "2026-11-20", count: 0 },
      { date: "2026-11-21", count: 9 },
      { date: "2026-11-22", count: 2 },
      { date: "2026-11-23", count: 0 },
      { date: "2026-11-24", count: 11 },
    ],
    trueRetention: 0.863,
    calibration: { predicted: 0.9, actual: 0.86 },
    reviewsPerDay: [{ date: "2026-11-18", count: 14 }],
    ...overrides,
  }) as unknown as DeckStats;

const deck = (termLang: string) =>
  ({
    slug: "DECK000001",
    title: "Mandarin HSK 1",
    description: "",
    termLang,
    meaningLang: "en",
    visibility: "private",
    publishedAt: null,
    forkedFrom: null,
    forkCount: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  }) as unknown as Deck;

const word = (term: string, reading: string | null) =>
  ({
    slug: "WRD000000001",
    term,
    reading,
    meaning: "to study",
    example: null,
    notes: null,
    createdAt: "2026-10-01T00:00:00.000Z",
  }) as unknown as Word;

const listed = (term: string, reading: string | null) =>
  ({ ...word(term, reading), cards: [] }) as unknown as WordWithCards;

const hard = (term: string, reading: string | null, termLang: string) =>
  ({
    ...word(term, reading),
    cards: [{ drill: "term_meaning", due: "2026-11-18T00:00:00.000Z", stabilityDays: 4, isHard: true }],
    deck: { slug: "DECK000001", title: "Mandarin HSK 1", termLang, meaningLang: "en" },
  }) as unknown as HardWord;

const labelled = (label: string) => document.querySelector(`[aria-label="${label}"]`);

describe("DeckProgress", () => {
  test("the next 7 study days, one cell each, in the dashboard's forecast markup", () => {
    render(<DeckProgress stats={stats()} />);

    const forecast = labelled("Due next 7 study days");

    expect([...(forecast?.querySelectorAll(".forecast b") ?? [])].map((cell) => cell.textContent)).toEqual([
      "14",
      "6",
      "0",
      "9",
      "2",
      "0",
      "11",
    ]);
    expect([...(forecast?.querySelectorAll(".forecast small") ?? [])].map((cell) => cell.textContent)).toEqual([
      "W",
      "T",
      "F",
      "S",
      "S",
      "M",
      "T",
    ]);
  });

  test("true retention as a whole percentage", () => {
    render(<DeckProgress stats={stats()} />);

    expect(labelled("True retention")?.textContent?.trim()).toBe("86%");
  });

  test("no reviews yet: true retention is an em dash, and the forecast still has its 7 cells", () => {
    render(<DeckProgress stats={stats({ trueRetention: null })} />);

    expect(labelled("True retention")?.textContent?.trim()).toBe("—");
    expect(labelled("Due next 7 study days")?.querySelectorAll(".forecast b")).toHaveLength(7);
  });

  test("the counts already on the strip stay", () => {
    render(<DeckProgress stats={stats()} />);

    expect(screen.getByLabelText("New 12, learning 30, mature 8")).not.toBeNull();

    // Paired by label, because the forecast's first day shows 14 as well.
    const counts = [...document.querySelectorAll(".kpi")].map((kpi) => [
      kpi.querySelector(".l")?.textContent,
      kpi.querySelector(".v")?.textContent,
    ]);

    for (const pair of [["due today", "14"], ["new", "12"], ["learning", "30"], ["mature", "8"]]) {
      expect(counts).toContainEqual(pair);
    }
  });
});

describe("a reading is tagged with its own script", () => {
  test.each([
    ["zh-Hans", "zh-Latn-pinyin"],
    ["yue", "yue-Latn-jyutping"],
    ["ja", "ja"],
  ])("the word list of a %s deck tags its readings %s", (termLang, lang) => {
    render(
      <WordList
        deck={deck(termLang)}
        words={[listed("学习", "xuéxí")]}
        now={NOW}
        onOpen={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(document.querySelector(".w-term rt")?.getAttribute("lang")).toBe(lang);
  });

  test.each([
    ["zh-Hans", "zh-Latn-pinyin"],
    ["ja", "ja"],
  ])("the word page hero of a %s deck tags its reading %s", (termLang, lang) => {
    render(<WordHero word={word("学习", "xuéxí")} termLang={termLang} meaningLang="en" />);

    expect(document.querySelector(".word-hero rt")?.getAttribute("lang")).toBe(lang);
  });

  test.each([
    ["zh", "zh-Latn-pinyin"],
    ["ja", "ja"],
  ])("a hard word from a %s deck is tagged %s", (termLang, lang) => {
    render(<HardWordList words={[hard("学习", "xuéxí", termLang)]} now={NOW} onUnmark={() => {}} />);

    expect(document.querySelector(".w-term rt")?.getAttribute("lang")).toBe(lang);
  });

  test("a word without a reading renders no ruby at all", () => {
    render(<WordHero word={word("ありがとう", null)} termLang="ja" meaningLang="en" />);

    expect(document.querySelector(".word-hero rt")).toBeNull();
  });
});
