import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import type { Learner, LearnerStats, Notifications } from "@voca/contract";
import { TodaySection } from "./TodaySection";
import type { Loadable } from "./dashboardModel";

// A deck studied in three drills gets the longest drill label the Today list shows. On a phone the row wraps, so
// the label and all four Today counts are in the page whole, never shortened.

const LABEL = "Pinyin → Hanzi 1 · Meaning → Hanzi 2 · Hanzi → Meaning 1";

const deck = {
  deckSlug: "DECK000001",
  title: "Mandarin HSK 3 · everyday verbs and the words that go with them",
  due: 4,
  overdue: 2,
  byDrill: [
    { drill: "reading_term", label: "Pinyin → Hanzi", due: 1 },
    { drill: "meaning_term", label: "Meaning → Hanzi", due: 2 },
    { drill: "term_meaning", label: "Hanzi → Meaning", due: 1 },
  ],
} as unknown as Notifications["decks"][number];

const state: Loadable<Notifications> = {
  kind: "loaded",
  value: { decks: [deck], hardDue: 3, newAvailable: 5, estimatedMinutes: 6 },
};

const stats: Loadable<LearnerStats> = {
  kind: "loaded",
  value: {
    maturity: { new: 0, learning: 28, mature: 0 },
    dueToday: 4,
    overdue: 2,
    forecast: [],
    trueRetention: 0.94,
    calibration: null,
    reviewsPerDay: [{ date: "2026-11-18", count: 31 }],
    streak: { days: 3, studiedToday: true },
  } as unknown as LearnerStats,
};

const learner = { name: "Ada" } as unknown as Learner;

describe("the Today panel with a long drill label", () => {
  test("the row shows the whole deck title and the whole drill label", () => {
    const { container } = render(<TodaySection state={state} stats={stats} learner={learner} />);

    const row = container.querySelector(".queue li a");

    expect(row?.querySelector(".qt")?.textContent).toBe(deck.title);
    expect(row?.querySelector(".qm")?.textContent).toBe(LABEL);
  });

  test("all four Today counts are shown", () => {
    const { container } = render(<TodaySection state={state} stats={stats} learner={learner} />);

    const counts = new Map(
      [...container.querySelectorAll(".today .kpi")].map((kpi) => [
        kpi.querySelector(".l")?.textContent,
        kpi.querySelector(".v")?.textContent,
      ]),
    );

    expect(counts.get("due")).toBe("4");
    expect(counts.get("new")).toBe("5");
    expect(counts.get("hard")).toBe("3");
    expect(counts.get("overdue")).toBe("2");
  });
});
