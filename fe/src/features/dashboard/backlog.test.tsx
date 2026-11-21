import { describe, expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import type { DeckSummary } from "@voca/contract";
import { backlogDecks } from "./backlog";
import { BacklogHint } from "./BacklogHint";

// A deck has a big backlog when more is due than max(3 × the session size, 30). A snoozed deck never counts.
// One hint names every such deck with its due count, and offers nothing to press.

const deck = (slug: string, title: string, dueCount: number, snooze: DeckSummary["snooze"] = null) =>
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
    snooze,
    wordCount: 400,
    dueCount,
  }) as unknown as DeckSummary;

const slugs = (decks: readonly DeckSummary[]) => decks.map((picked) => String(picked.slug));

describe("backlogDecks", () => {
  test("with a session size of 20, 61 due is a backlog and 60 is not", () => {
    const decks = [deck("DECK000001", "Japanese N4", 61), deck("DECK000002", "Mandarin HSK 1", 60)];

    expect(slugs(backlogDecks(decks, 20))).toEqual(["DECK000001"]);
  });

  test("with a session size of 7, the threshold is 30, not 21", () => {
    const decks = [deck("DECK000001", "Japanese N4", 31), deck("DECK000002", "Mandarin HSK 1", 30), deck("DECK000003", "Korean", 22)];

    expect(slugs(backlogDecks(decks, 7))).toEqual(["DECK000001"]);
  });

  test("a snoozed deck never counts, with or without an end date", () => {
    const decks = [
      deck("DECK000001", "Japanese N4", 500, { until: null }),
      deck("DECK000002", "Mandarin HSK 1", 500, { until: "2026-12-01T04:00:00.000Z" } as unknown as DeckSummary["snooze"]),
      deck("DECK000003", "Korean", 90),
    ];

    expect(slugs(backlogDecks(decks, 10))).toEqual(["DECK000003"]);
  });

  test("several decks keep the list's order", () => {
    const decks = [deck("DECK000001", "Japanese N4", 84), deck("DECK000002", "Korean", 10), deck("DECK000003", "Mandarin HSK 1", 120)];

    expect(slugs(backlogDecks(decks, 10))).toEqual(["DECK000001", "DECK000003"]);
  });
});

describe("BacklogHint", () => {
  test("names the deck and its due count, with nothing to press", () => {
    render(<BacklogHint decks={[deck("DECK000001", "Japanese N4", 84), deck("DECK000002", "Korean", 12)]} sessionSize={20} />);

    const hint = screen.getByRole("note");
    expect(hint.textContent).toContain("Japanese N4");
    expect(hint.textContent).toContain("84");
    expect(hint.textContent).not.toContain("Korean");
    expect(within(hint).queryAllByRole("button")).toHaveLength(0);
    expect(within(hint).queryAllByRole("link")).toHaveLength(0);
  });

  test("several decks share one hint, each with its due count", () => {
    render(<BacklogHint decks={[deck("DECK000001", "Japanese N4", 84), deck("DECK000003", "Mandarin HSK 1", 120)]} sessionSize={10} />);

    const hints = screen.getAllByRole("note");
    expect(hints).toHaveLength(1);
    expect(hints[0]?.textContent).toContain("Japanese N4");
    expect(hints[0]?.textContent).toContain("84");
    expect(hints[0]?.textContent).toContain("Mandarin HSK 1");
    expect(hints[0]?.textContent).toContain("120");
  });

  test("no deck with a backlog shows no hint", () => {
    const { container } = render(<BacklogHint decks={[deck("DECK000001", "Japanese N4", 60)]} sessionSize={20} />);

    expect(screen.queryByRole("note")).toBeNull();
    expect(container.textContent).toBe("");
  });
});
