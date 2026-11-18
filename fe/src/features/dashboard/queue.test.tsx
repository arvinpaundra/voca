import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import type { DeckStats, Learner, LearnerStats, Notifications } from "@voca/contract";
import { startFailure } from "../study/startFailure";
import { estimateText, nextDueDate } from "./queueSummary";
import { TodaySection } from "./TodaySection";
import type { Loadable } from "./useLoadable";

// Nothing to study is a state of its own: no Start button, the next due day instead, and no promise of
// new words the decks don't have. A queue carries the time it is likely to take.

const forecast = (counts: readonly number[]): DeckStats["forecast"] =>
  counts.map((count, index) => ({ date: `2026-11-${String(18 + index).padStart(2, "0")}`, count })) as DeckStats["forecast"];

const stats = (overrides: Partial<Record<keyof LearnerStats, unknown>> = {}): Loadable<LearnerStats> => ({
  kind: "loaded",
  value: {
    maturity: { new: 0, learning: 28, mature: 0 },
    dueToday: 0,
    overdue: 0,
    forecast: forecast([0, 5, 10, 0, 0, 0, 0]),
    trueRetention: 0.94,
    calibration: null,
    reviewsPerDay: [{ date: "2026-11-18", count: 31 }],
    streak: { days: 3, studiedToday: true },
    ...overrides,
  } as unknown as LearnerStats,
});

const deckRow = (due: number) =>
  ({
    deckSlug: "DECK000001",
    title: "test",
    due,
    overdue: 0,
    byDrill: [{ drill: "term_meaning", label: "Word → Meaning", due }],
  }) as unknown as Notifications["decks"][number];

const panel = (
  decks: Notifications["decks"],
  newAvailable: number,
  estimatedMinutes: number | null,
): Loadable<Notifications> => ({
  kind: "loaded",
  value: { decks, hardDue: 0, newAvailable, estimatedMinutes },
});

const learner = { name: "Ada" } as unknown as Learner;

describe("estimateText", () => {
  test.each([
    [12, "About 12 minutes"],
    [1, "About 1 minute"],
  ])("%p minutes reads as %p", (minutes, text) => {
    expect(estimateText(minutes)).toBe(text);
  });

  test("no measured pace means no estimate", () => {
    expect(estimateText(null)).toBeNull();
  });
});

describe("nextDueDate", () => {
  test("the first day of the forecast that has cards", () => {
    expect(nextDueDate(forecast([0, 5, 10, 0, 0, 0, 0]))).toBe("2026-11-19");
  });

  test("today counts when cards fall due today", () => {
    expect(nextDueDate(forecast([3, 0, 0, 0, 0, 0, 0]))).toBe("2026-11-18");
  });

  test("an empty week has no next day", () => {
    expect(nextDueDate(forecast([0, 0, 0, 0, 0, 0, 0]))).toBeNull();
  });
});

describe("startFailure", () => {
  test("nothing to study says so, instead of a generic failure", () => {
    expect(startFailure("NothingToStudy")).toBe("Nothing is due in this deck, and no new words are left for today.");
  });

  test.each([
    ["DeckTooSmall", "This deck has too few words for that session size. Choose a smaller size."],
    ["DrillNotAvailable", "One of the drills is not available in this deck. Pick the drills again."],
    [undefined, "Could not start the session. Try again."],
  ])("%p keeps its message", (tag, message) => {
    expect(startFailure(tag)).toBe(message);
  });
});

describe("the Today card", () => {
  test("a queue shows Start studying with the time it will take", () => {
    render(<TodaySection state={panel([deckRow(14)], 6, 12)} stats={stats()} learner={learner} />);

    expect(screen.getByRole("link", { name: /Start studying/ })).not.toBeNull();
    expect(screen.getByText("About 12 minutes")).not.toBeNull();
  });

  test("nothing to study: no Start button, and the next due day instead", () => {
    render(<TodaySection state={panel([], 0, null)} stats={stats()} learner={learner} />);

    expect(screen.queryByRole("link", { name: /Start studying/ })).toBeNull();
    expect(document.querySelector("[data-next-due]")?.getAttribute("data-next-due")).toBe("2026-11-19");
  });

  test("an empty queue with nothing ahead says nothing about a next review", () => {
    render(
      <TodaySection
        state={panel([], 0, null)}
        stats={stats({ forecast: forecast([0, 0, 0, 0, 0, 0, 0]) })}
        learner={learner}
      />,
    );

    expect(document.querySelector("[data-next-due]")).toBeNull();
  });
});
