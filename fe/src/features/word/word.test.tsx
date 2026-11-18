import { describe, expect, mock, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateTime } from "effect";
import type { Deck, DeckDetail, DeckDrill, DeckStats, Word, WordDrillStats, WordWithCards } from "@voca/contract";
import { deckCounts } from "../deck/deckCounts";
import { WordList } from "../deck/WordList";
import { DrillPanel } from "./DrillPanel";
import { WordHero } from "./WordHero";
import { wordHref } from "./wordHref";
import { wordTabs } from "./wordTabs";

// Markup and class names follow the word page screen of docs/design/ui-refinement.html (Console).

const NOW = DateTime.makeUnsafe("2026-11-18T12:00:00.000Z");

const word = {
  slug: "WRD000000001",
  term: "食べる",
  reading: "たべる",
  meaning: "to eat",
  example: "毎朝パンを食べる。",
  notes: null,
  createdAt: "2026-10-01T00:00:00.000Z",
} as unknown as Word;

const stats = (overrides: Partial<Record<keyof WordDrillStats, unknown>> = {}) =>
  ({
    drill: "term_meaning",
    label: "Term → Meaning",
    maturity: "learning",
    recallNow: 0.82,
    stabilityDays: 12.4,
    difficulty: 5.6,
    reps: 14,
    lapses: 4,
    leech: true,
    isHard: false,
    accuracy: { overall: 0.78, last10: 0.9, easy: 0.84, hard: 0.61 },
    streak: 5,
    medianLatencyMs: 2100,
    attemptsToCorrect: 1.3,
    nextDue: "2026-11-21T09:00:00.000Z",
    intervalDays: 12,
    firstSeen: "2026-10-03T09:00:00.000Z",
    lastReviewed: "2026-11-18T09:04:00.000Z",
    confusedWith: [
      { wordSlug: "WRD000000002", term: "飲む", count: 6 },
      { wordSlug: "WRD000000009", term: "寝る", count: 1 },
    ],
    history: [
      { at: "2026-11-18T09:04:00.000Z", correct: true, rating: 3, latencyMs: 1800, predictedRecall: 0.86, intervalDays: 12 },
      { at: "2026-11-14T08:12:00.000Z", correct: false, rating: 1, latencyMs: 4200, predictedRecall: 0.71, intervalDays: 1 },
      { at: "2026-11-09T19:40:00.000Z", correct: true, rating: 2, latencyMs: 6000, predictedRecall: null, intervalDays: 5 },
    ],
    ...overrides,
  }) as unknown as WordDrillStats;

const sorted = (element: Element | null | undefined) => [...(element?.classList ?? [])].sort();

describe("WordHero", () => {
  test("the term with its reading, the meaning and the example", () => {
    const { container } = render(<WordHero word={word} termLang="ja" meaningLang="en" />);

    expect(screen.getByText("to eat").classList.contains("m")).toBe(true);

    const hero = container.querySelector(".word-hero") as HTMLElement;
    const term = hero.querySelector("p.t");
    expect(term?.getAttribute("lang")).toBe("ja");
    expect(term?.querySelector("rt")?.textContent).toBe("たべる");
    expect(within(hero).getByText("毎朝パンを食べる。")).toBeDefined();
  });
});

describe("DrillPanel", () => {
  test("status: maturity, the leech suggestion and Mark as hard", async () => {
    const user = userEvent.setup();
    const onToggleHard = mock((_hard: boolean) => {});
    const { container } = render(<DrillPanel stats={stats()} timezone="UTC" now={NOW} onToggleHard={onToggleHard} />);

    screen.getByRole("button", { name: "Mark as hard" });
    const head = container.querySelector(".drill-head") as HTMLElement;
    expect(sorted(within(head).getByText("Learning"))).toEqual(["badge"]);
    expect(sorted(within(head).getByText("Leech · 4 lapses"))).toEqual(["badge", "badge-lime"]);

    const toggle = within(head).getByRole("button", { name: "Mark as hard" });
    expect(sorted(toggle)).toEqual(["btn", "btn-secondary", "btn-sm"]);

    await user.click(toggle);
    expect(onToggleHard).toHaveBeenCalledWith(true);
  });

  test("a hard card offers Unmark hard, and no leech badge when it is not a leech", async () => {
    const user = userEvent.setup();
    const onToggleHard = mock((_hard: boolean) => {});
    render(<DrillPanel stats={stats({ isHard: true, leech: false, maturity: "mature" })} timezone="UTC" now={NOW} onToggleHard={onToggleHard} />);

    expect(screen.queryByText(/Leech/)).toBeNull();
    expect(screen.getByText("Mature")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Unmark hard" }));
    expect(onToggleHard).toHaveBeenCalledWith(false);
  });

  test("memory: recall now, stability, difficulty band and next due, in a .deck-stats-strip", () => {
    render(<DrillPanel stats={stats()} timezone="UTC" now={NOW} onToggleHard={() => {}} />);

    const memory = screen.getByRole("region", { name: "Memory" });
    expect(memory.classList.contains("deck-stats-strip")).toBe(true);
    expect(within(memory).getAllByRole("term").map((t) => t.textContent)).toEqual([
      "recall now",
      "stability",
      "difficulty",
      "next due · in 3 days",
    ]);
    expect(within(memory).getAllByRole("definition").map((d) => d.textContent)).toEqual(["82%", "12.4d", "Medium", "Sat 21"]);
  });

  test("effort and fluency", () => {
    render(<DrillPanel stats={stats()} timezone="UTC" now={NOW} onToggleHard={() => {}} />);

    const effort = screen.getByRole("region", { name: "Effort" });
    expect(effort.classList.contains("card")).toBe(true);
    expect(within(effort).getByRole("heading", { level: 2, name: "Effort and fluency" })).toBeDefined();
    expect(within(effort).getAllByRole("term").map((t) => t.textContent)).toEqual([
      "reviews",
      "lapses",
      "accuracy · 90% last 10",
      "median answer",
      "correct in a row",
      "attempts to clear",
    ]);
    expect(within(effort).getAllByRole("definition").map((d) => d.textContent)).toEqual(["14", "4", "78%", "2.1s", "5", "1.3"]);
    expect(effort.textContent).toContain("Easy vs hard mode accuracy");
    expect(effort.textContent).toContain("84% · 61%");
    expect(effort.textContent).toContain("3 Oct · 18 Nov");
  });

  test("confused with, most picked first", () => {
    render(<DrillPanel stats={stats()} timezone="UTC" now={NOW} onToggleHard={() => {}} />);

    const confused = screen.getByRole("region", { name: "Confused with" });
    const items = [...confused.querySelectorAll(".preview-list li")];

    expect(items.map((item) => item.textContent)).toEqual(["飲む6 times", "寝る1 time"]);
    expect(items[0]?.querySelector(".t")?.textContent).toBe("飲む");
  });

  test("history: a strip oldest to newest, and rows newest first", () => {
    render(<DrillPanel stats={stats()} timezone="UTC" now={NOW} onToggleHard={() => {}} />);

    const history = screen.getByRole("region", { name: "History" });
    expect([...history.querySelectorAll(".strip i")].map((mark) => mark.className)).toEqual(["r", "w", "r"]);

    const rows = [...history.querySelectorAll(".hist li")];
    expect(rows[0]?.classList.contains("head")).toBe(true);
    expect([...rows[1]!.children].map((cell) => cell.textContent)).toEqual(["18 Nov 09:04", "Right", "Good", "1.8s", "86%", "12d"]);
    expect([...rows[2]!.children].map((cell) => cell.textContent)).toEqual(["14 Nov 08:12", "Wrong", "Again", "4.2s", "71%", "1d"]);
    expect(rows[2]?.children[1]?.className).toBe("no");
    expect([...rows[3]!.children].map((cell) => cell.textContent)).toEqual(["9 Nov 19:40", "Right", "Hard", "6.0s", "—", "5d"]);
  });
});

describe("tabs and links", () => {
  test("one tab per deck drill; drills the word has no card in are new", () => {
    const drills = [
      { drill: "term_meaning", label: "Term → Meaning", due: 1, new: 0 },
      { drill: "reading_term", label: "Reading → Term", due: 0, new: 0 },
      { drill: "meaning_term", label: "Meaning → Term", due: 0, new: 3 },
    ] as unknown as DeckDrill[];

    expect(wordTabs(drills, [stats(), stats({ drill: "reading_term", label: "Reading → Term" })])).toEqual([
      { value: "term_meaning", label: "Term → Meaning" },
      { value: "reading_term", label: "Reading → Term" },
      { value: "meaning_term", label: "Meaning → Term", count: "new" },
    ]);
  });

  test("the word page lives under its deck, and the deck's word list links to it", () => {
    expect(wordHref("DECK000001", "WRD000000001")).toBe("/app/decks/DECK000001/words/WRD000000001");

    const deck = { slug: "DECK000001", termLang: "ja", meaningLang: "en" } as unknown as Deck;
    const listed = { ...word, cards: [] } as unknown as WordWithCards;
    render(<WordList deck={deck} words={[listed]} now={NOW} onEdit={() => {}} onDelete={() => {}} />);

    const link = screen.getByRole("link", { name: /食べる/ });
    expect(link.getAttribute("href")).toBe("/app/decks/DECK000001/words/WRD000000001");
    expect(link.closest(".w-term")).not.toBeNull();
  });
});

describe("deck counts", () => {
  const deckStats = { maturity: { new: 48, learning: 96, mature: 104 }, dueToday: 20 } as unknown as DeckStats;

  test("All and the search placeholder count words; the other tabs count cards from the stats", () => {
    const deck = { wordCount: 248, dueCount: 20 } as unknown as DeckDetail;

    expect(deckCounts(deck, deckStats)).toEqual({
      tabs: [
        { value: "all", label: "All", count: 248 },
        { value: "due", label: "Due", count: 20 },
        { value: "new", label: "New", count: 48 },
        { value: "hard", label: "Hard" },
        { value: "mature", label: "Mature", count: 104 },
      ],
      searchPlaceholder: "Search 248 words",
    });
  });

  test("before the counts arrive, the tabs show no counts", () => {
    expect(deckCounts({} as unknown as DeckDetail, null)).toEqual({
      tabs: [
        { value: "all", label: "All" },
        { value: "due", label: "Due" },
        { value: "new", label: "New" },
        { value: "hard", label: "Hard" },
        { value: "mature", label: "Mature" },
      ],
      searchPlaceholder: "Search words",
    });
  });
});
