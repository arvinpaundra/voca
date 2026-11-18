import { describe, expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import type { DeckSummary, Learner, LearnerStats, Notifications } from "@voca/contract";
import { DecksSection } from "./DecksSection";
import { ProgressSection } from "./ProgressSection";
import { StreakSection } from "./StreakSection";
import { TodaySection } from "./TodaySection";
import type { Loadable } from "./useLoadable";

// Markup and class names follow the dashboard screen of docs/design/ui-refinement.html (Console).

const learner = {
  slug: "AKTN0001",
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

const queueDeck = (deckSlug: string, title: string, due: number, overdue: number, byDrill: Array<[string, number]> = []) =>
  ({
    deckSlug,
    title,
    due,
    overdue,
    byDrill: byDrill.map(([label, n]) => ({ drill: "term_meaning", label, due: n })),
  }) as unknown as Notifications["decks"][number];

const notifications = (decks: Notifications["decks"], newAvailable = 10): Loadable<Notifications> => ({
  kind: "loaded",
  value: { decks, hardDue: 5, newAvailable },
});

const days = (count: number, from: string, counts: number[]) =>
  Array.from({ length: count }, (_, i) => {
    const day = new Date(`${from}T00:00:00.000Z`);
    day.setUTCDate(day.getUTCDate() + i);
    return { date: day.toISOString().slice(0, 10), count: counts[i] ?? 0 };
  });

const reviews = [12, 18, 0, 22, 30, 14, 9, 26, 31, 20, 0, 16, 24, 28, 19, 12, 35, 22, 18, 25, 30, 14, 0, 21, 27, 33, 18, 24, 29, 18];

const learnerStats = (studiedToday: boolean): Loadable<LearnerStats> => ({
  kind: "loaded",
  value: {
    maturity: { new: 72, learning: 204, mature: 186 },
    dueToday: 32,
    overdue: 3,
    forecast: days(7, "2026-11-18", [32, 18, 24, 9, 12, 30, 15]),
    trueRetention: 0.86,
    calibration: { predicted: 0.88, actual: 0.86 },
    reviewsPerDay: days(30, "2026-10-20", reviews),
    streak: { days: 12, studiedToday },
  } as unknown as LearnerStats,
});

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
  const queue = [
    queueDeck("DECK000001", "Japanese N5 verbs", 20, 0, [
      ["Term → Meaning", 14],
      ["Reading", 6],
    ]),
    queueDeck("DECK000002", "Kanji radicals", 9, 3),
    queueDeck("DECK000003", "Arabic everyday nouns", 3, 0, [["Meaning → Term", 3]]),
  ];

  test("the .today card: eyebrow, headline with the count marked, numbers, queue and one start button", () => {
    render(<TodaySection state={notifications(queue)} stats={learnerStats(true)} learner={learner} />);

    const today = screen.getByRole("region", { name: "Today" });
    expect(today.classList.contains("today")).toBe(true);
    expect(within(today).getByText("Today").classList.contains("eyebrow")).toBe(true);

    const headline = within(today).getByRole("heading", { level: 2 });
    expect(headline.textContent).toBe("You have 32 cards to review and 10 new words waiting.");
    expect(headline.querySelector("em")?.textContent).toBe("32 cards");

    expect(within(today).getAllByRole("term").map((term) => term.textContent)).toEqual([
      "due",
      "new",
      "hard",
      "overdue",
      "reviewed today",
    ]);
    expect(within(today).getAllByRole("definition").map((value) => value.textContent)).toEqual(["32", "10", "5", "3", "18"]);
    expect(within(today).getByText("due").closest(".kpi")?.classList.contains("hl")).toBe(true);

    const rows = today.querySelectorAll(".queue li a");
    expect(rows).toHaveLength(3);
    expect(rows[0]?.getAttribute("href")).toBe("/app/decks/DECK000001/study");
    expect(rows[0]?.querySelector(".qt")?.textContent).toBe("Japanese N5 verbs");
    expect(rows[0]?.querySelector(".qm")?.textContent).toBe("Term → Meaning 14 · Reading 6");
    expect(rows[0]?.querySelector(".qn")?.textContent).toBe("20");
    expect(rows[1]?.querySelector(".qm")?.textContent).toBe("3 overdue");
    expect(rows[2]?.querySelector(".qm")?.textContent).toBe("Meaning → Term");

    const start = within(today).getAllByRole("link", { name: "Start studying" });
    expect(start).toHaveLength(1);
    expect(start[0]?.getAttribute("href")).toBe("/app/decks/DECK000001/study");
    expect(start[0]?.classList.contains("btn-primary")).toBe(true);
    expect(start[0]?.closest(".today-cta")).not.toBeNull();
  });

  test("headline variants: only new words, and nothing to do", () => {
    const { unmount } = render(<TodaySection state={notifications([], 10)} stats={learnerStats(true)} learner={learner} />);

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("You have 10 new words waiting.");
    unmount();

    render(<TodaySection state={notifications([], 0)} stats={learnerStats(true)} learner={learner} />);

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("You're all caught up!");
    expect(screen.queryByRole("link", { name: "Start studying" })).toBeNull();
  });

  test("reviewed today is a dash until the stats load; loading and failure have their states", () => {
    const { unmount } = render(<TodaySection state={notifications(queue)} stats={{ kind: "loading" }} learner={learner} />);

    expect(screen.getAllByRole("definition").at(-1)?.textContent).toBe("—");
    unmount();

    const loading = render(<TodaySection state={{ kind: "loading" }} stats={{ kind: "loading" }} learner={learner} />);
    expect(screen.getByRole("status", { name: "Loading today", busy: true })).toBeDefined();
    loading.unmount();

    render(<TodaySection state={{ kind: "failed" }} stats={{ kind: "loading" }} learner={learner} />);
    expect(within(screen.getByRole("alert")).getByText("Couldn't load today.")).toBeDefined();
  });
});

describe("DecksSection", () => {
  const decks = [
    deck("DECK000001", "Verbs", 2),
    deck("DECK000002", "Japanese N5 verbs", 20, 248),
    deck("DECK000003", "Kitchen", 0),
    deck("DECK000004", "Kanji radicals", 9, 214),
    deck("DECK000005", "Numbers", 1),
  ];

  test("a .card titled Your decks: the three decks with the most due as .deck rows", () => {
    render(<DecksSection state={{ kind: "loaded", value: decks }} />);

    const card = screen.getByRole("region", { name: "Decks" });
    expect(card.classList.contains("card")).toBe(true);

    const title = within(card).getByRole("heading", { level: 2, name: "Your decks" });
    expect(title.classList.contains("h2")).toBe(true);
    expect(within(card).getByRole("link", { name: "All decks" }).getAttribute("href")).toBe("/app/decks");

    const rows = card.querySelectorAll(".deck-grid li article.deck");
    expect(rows).toHaveLength(3);

    const first = within(rows[0] as HTMLElement);
    expect(first.getByRole("link", { name: "Japanese N5 verbs" }).classList.contains("deck-title")).toBe(true);
    expect(rows[0]?.querySelector(".deck-stats .due")?.textContent).toBe("20");
    expect(rows[0]?.querySelector(".deck-stats .words")?.textContent).toBe("248");

    const study = first.getByRole("link", { name: "Study Japanese N5 verbs" });
    expect(study.getAttribute("href")).toBe("/app/decks/DECK000002/study");
    expect([...study.classList].sort()).toEqual(["btn", "btn-secondary", "btn-sm"]);
  });

  test("no decks is an empty state with a way to create one", () => {
    render(<DecksSection state={{ kind: "loaded", value: [] }} />);

    expect(screen.getByRole("heading", { name: "No decks yet" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Create deck" }).getAttribute("href")).toBe("/app/decks");
  });

  test("loading is a busy placeholder and a failure is an alert", () => {
    const { unmount } = render(<DecksSection state={{ kind: "loading" }} />);

    expect(screen.getByRole("status", { name: "Loading decks", busy: true })).toBeDefined();
    unmount();

    render(<DecksSection state={{ kind: "failed" }} />);

    expect(within(screen.getByRole("alert")).getByText("Couldn't load your decks.")).toBeDefined();
  });
});

describe("StreakSection", () => {
  test("the streak count with its flame, and the last seven days as dots", () => {
    render(<StreakSection state={learnerStats(false)} />);

    const card = screen.getByRole("region", { name: "Streak" });
    expect(card.querySelector(".streak .flame")).not.toBeNull();
    expect(card.querySelector(".streak .v")?.textContent).toBe("12");
    expect(card.querySelector(".streak .l")?.textContent).toBe("day streak");

    const dots = [...card.querySelectorAll(".week i")];
    expect(dots).toHaveLength(7);
    expect(dots.slice(0, 6).every((dot) => dot.classList.contains("done"))).toBe(true);
    expect(dots[6]?.classList.contains("now")).toBe(true);
  });

  test("today is a done dot once studied", () => {
    render(<StreakSection state={learnerStats(true)} />);

    const dots = screen.getByRole("region", { name: "Streak" }).querySelectorAll(".week i");

    expect(dots[6]?.classList.contains("done")).toBe(true);
  });
});

describe("ProgressSection", () => {
  test("mastered words, the retention ring, maturity, 30 days of reviews and the next 7 days", () => {
    render(<ProgressSection state={learnerStats(true)} />);

    const card = screen.getByRole("region", { name: "Progress" });
    expect(within(card).getByRole("heading", { level: 2, name: "Progress" }).classList.contains("h2")).toBe(true);

    expect(within(card).getByText("words mastered").closest(".kpi")?.querySelector(".v")?.textContent).toBe("186");
    expect(card.querySelector(".ring-meter")?.getAttribute("data-label")).toBe("86%");

    const legend = card.querySelector(".maturity .legend")?.textContent ?? "";
    expect(legend).toContain("New 72");
    expect(legend).toContain("Learning 204");
    expect(legend).toContain("Mature 186");

    const bars = [...card.querySelectorAll(".bars span")];
    expect(bars).toHaveLength(30);
    expect(bars.at(-1)?.classList.contains("is-today")).toBe(true);
    expect(bars[16]?.classList.contains("hi")).toBe(true);

    expect(card.querySelectorAll(".forecast > div")).toHaveLength(7);
    expect(card.querySelector(".forecast b")?.textContent).toBe("32");
    expect(card.textContent).toContain("88% · 86%");
  });
});
