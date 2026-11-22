import { afterEach, describe, expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import type { DeckSummary } from "@voca/contract";
import { cacheSession } from "../../test/cacheSession";
import { deckSummary, pad, pageOf } from "../../test/pagedApi";
import { DashboardPage } from "./DashboardPage";

// The dashboard reads the decks the most due first, 200 a page. Its top 3 and its backlog hint cover every deck: it
// asks for the next page while the last deck read is still behind.

type Query = { sort?: string; cursor?: string; limit?: number };

const learner = {
  slug: "LRN000001",
  email: "learner@example.com",
  name: "Arvin Paundra",
  avatarUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  settings: { timezone: "UTC", dayStartHour: 4, desiredRetention: 0.9, newPerDay: 10, defaultSessionSize: 10, defaultMode: "easy" },
};

const notifications = { decks: [], hardDue: 0, newAvailable: 0, estimatedMinutes: null };

const stats = {
  maturity: { new: 0, learning: 0, mature: 0 },
  dueToday: 0,
  overdue: 0,
  forecast: [],
  trueRetention: null,
  calibration: null,
  reviewsPerDay: [],
  streak: { days: 0, studiedToday: false },
};

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
});

/** Decks as the server sends them for `sort=due`: the most due first. */
const serve = (decks: readonly DeckSummary[]) => {
  const requests: Query[] = [];

  const api = cacheSession("PF", {
    "me.get": () => learner,
    "insight.learnerStats": () => stats,
    "insight.notifications": () => notifications,
    "insight.activity": () => ({ month: "2026-11", days: [] }),
    "library.listDecks": (request: { query: Query }) => {
      requests.push(request.query);

      return { ...pageOf(decks, request.query), total: decks.length, termLangs: ["ja"] };
    },
  });
  restore = api.restore;

  return requests;
};

const due = (i: number, dueCount: number, snooze: DeckSummary["snooze"] = null): DeckSummary => ({
  ...deckSummary(i),
  title: `Deck ${pad(i)}`,
  dueCount,
  snooze,
});

describe("the dashboard's decks", () => {
  test("names a behind deck that is not among the first 15, with one request", async () => {
    // 20 decks far behind, then 230 with nothing due.
    const requests = serve([...Array.from({ length: 20 }, (_, i) => due(i, 100)), ...Array.from({ length: 230 }, (_, i) => due(20 + i, 0))]);
    render(<DashboardPage />);

    const hint = await screen.findByRole("note");

    expect(hint.textContent).toContain("Deck 00 has 100 words due.");
    expect(hint.textContent).toContain("Deck 19 has 100 words due.");
    expect(hint.textContent).not.toContain("Deck 20");
    expect(requests).toEqual([{ sort: "due", limit: 200 }]);
  });

  test("asks for the next page while the last deck read is still behind", async () => {
    const requests = serve(Array.from({ length: 230 }, (_, i) => due(i, 50)));
    render(<DashboardPage />);

    const hint = await screen.findByText(/Deck 229 has 50 words due\./);

    expect(hint).toBeDefined();
    expect(requests).toEqual([
      { sort: "due", limit: 200 },
      { sort: "due", limit: 200, cursor: "200" },
    ]);
  });

  test("a snoozed deck is not named, and does not stop the reading", async () => {
    const snoozed = { until: null } as DeckSummary["snooze"];
    serve([due(0, 90, snoozed), due(1, 90, snoozed), due(2, 40), due(3, 31), due(4, 30), due(5, 0)]);
    render(<DashboardPage />);

    const hint = await screen.findByRole("note");

    expect(hint.textContent).toContain("Deck 02 has 40 words due. Deck 03 has 31 words due.");
    expect(hint.textContent).not.toContain("Deck 00");
    expect(hint.textContent).not.toContain("Deck 04");
  });

  test("Your decks shows the three most due", async () => {
    serve([due(0, 9), due(1, 7), due(2, 5), due(3, 1), due(4, 0)]);
    render(<DashboardPage />);

    const section = await screen.findByRole("region", { name: "Decks" });

    expect(within(section).getAllByRole("link", { name: /^Deck / }).map((link) => link.textContent)).toEqual(["Deck 00", "Deck 01", "Deck 02"]);
  });

  test("a Learner with no deck sees no hint and an empty Your decks", async () => {
    serve([]);
    render(<DashboardPage />);

    await screen.findByText("No decks yet");

    expect(screen.queryByRole("note")).toBeNull();
  });
});
