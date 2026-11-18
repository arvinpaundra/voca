import { describe, expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import type { DeckSummary, Learner, LearnerStats, Notifications } from "@voca/contract";
import { DecksSection } from "./DecksSection";
import { TodaySection } from "./TodaySection";
import type { Loadable } from "./useLoadable";

const learner = {
  slug: "LRNR0001",
  email: "learner@example.com",
  name: "Aiko Tanaka",
  avatarUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  settings: {
    timezone: "UTC",
    dayStartHour: 4,
    desiredRetention: 0.9,
    newPerDay: 20,
    defaultSessionSize: 10,
    defaultMode: "easy",
  },
} as unknown as Learner;

const notifications = (decks: Notifications["decks"], newAvailable = 5): Loadable<Notifications> => ({
  kind: "loaded",
  value: { decks, hardDue: 2, newAvailable },
});

const dueDeck = (deckSlug: string, title: string, due: number, overdue: number) =>
  ({ deckSlug, title, due, overdue, byDrill: [] }) as unknown as Notifications["decks"][number];

const statsLoading: Loadable<LearnerStats> = { kind: "loading" };

const deck = (slug: string, title: string, dueCount: number, wordCount = 40) =>
  ({
    slug,
    title,
    description: "",
    termLang: "ja",
    meaningLang: "en",
    visibility: "private",
    publishedAt: null,
    forkedFrom: null,
    forkCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    wordCount,
    dueCount,
  }) as unknown as DeckSummary;

describe("TodaySection", () => {
  test("with work due: a headline, the day's numbers and one way to start", () => {
    render(
      <TodaySection
        state={notifications([dueDeck("DECK000001", "JLPT N5", 9, 3), dueDeck("DECK000002", "Kitchen", 3, 0)])}
        stats={statsLoading}
        learner={learner}
      />,
    );

    const today = screen.getByRole("region", { name: "Today" });

    expect(within(today).getByRole("heading", { level: 2, name: "You have 12 cards to review." })).toBeDefined();
    expect(within(today).getAllByRole("term").map((term) => term.textContent)).toEqual([
      "Due",
      "New",
      "Hard",
      "Overdue",
      "Reviewed",
    ]);
    expect(within(today).getAllByRole("definition").map((value) => value.textContent)).toEqual([
      "12",
      "5",
      "2",
      "3",
      "—",
    ]);

    const start = within(today).getAllByRole("link", { name: "Start studying" });
    expect(start).toHaveLength(1);
    expect(start[0]?.getAttribute("href")).toBe("/app/decks/DECK000001/study");
  });

  test("with nothing to do: caught up, and no start link", () => {
    render(<TodaySection state={notifications([], 0)} stats={statsLoading} learner={learner} />);

    const today = screen.getByRole("region", { name: "Today" });

    expect(within(today).getByRole("heading", { level: 2, name: "You're all caught up!" })).toBeDefined();
    expect(within(today).queryByRole("link", { name: "Start studying" })).toBeNull();
  });

  test("loading is a busy placeholder and a failure is an alert", () => {
    const { unmount } = render(<TodaySection state={{ kind: "loading" }} stats={statsLoading} learner={learner} />);

    expect(screen.getByRole("status", { name: "Loading today", busy: true })).toBeDefined();
    unmount();

    render(<TodaySection state={{ kind: "failed" }} stats={statsLoading} learner={learner} />);

    expect(within(screen.getByRole("alert")).getByText("Couldn't load today.")).toBeDefined();
  });
});

describe("DecksSection", () => {
  const decks = [
    deck("DECK000001", "Verbs", 2),
    deck("DECK000002", "JLPT N5", 30),
    deck("DECK000003", "Kitchen", 0),
    deck("DECK000004", "Travel", 7),
    deck("DECK000005", "Numbers", 1),
    deck("DECK000006", "Colours", 4),
    deck("DECK000007", "Animals", 0),
  ];

  test("the six decks with the most due, as table rows with column headers", () => {
    render(<DecksSection state={{ kind: "loaded", value: decks }} />);

    const table = screen.getByRole("table", { name: "My decks" });
    const headers = within(table).getAllByRole("columnheader").map((header) => header.textContent);
    expect(headers).toEqual(["Deck", "Due", "Words", "Actions"]);

    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(6);

    const first = rows[0]!;
    expect(within(first).getByRole("link", { name: "JLPT N5" }).getAttribute("href")).toBe("/app/decks/DECK000002");
    expect(within(first).getByRole("link", { name: "Study JLPT N5" }).getAttribute("href")).toBe(
      "/app/decks/DECK000002/study",
    );
  });

  test("a deck with nothing due has no study link", () => {
    render(<DecksSection state={{ kind: "loaded", value: [deck("DECK000003", "Kitchen", 0)] }} />);

    const table = screen.getByRole("table", { name: "My decks" });

    expect(within(table).getByRole("link", { name: "Kitchen" })).toBeDefined();
    expect(within(table).queryByRole("link", { name: "Study Kitchen" })).toBeNull();
  });

  test("no decks is an empty state with a way to create one", () => {
    render(<DecksSection state={{ kind: "loaded", value: [] }} />);

    expect(screen.getByRole("heading", { name: "No decks yet" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Create deck" }).getAttribute("href")).toBe("/app/decks");
    expect(screen.queryByRole("table")).toBeNull();
  });

  test("loading is a busy placeholder and a failure is an alert", () => {
    const { unmount } = render(<DecksSection state={{ kind: "loading" }} />);

    expect(screen.getByRole("status", { name: "Loading decks", busy: true })).toBeDefined();
    unmount();

    render(<DecksSection state={{ kind: "failed" }} />);

    expect(within(screen.getByRole("alert")).getByText("Couldn't load your decks.")).toBeDefined();
  });
});
