import { afterEach, describe, expect, test } from "bun:test";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { drillLabel } from "@voca/contract";
import { cacheSession } from "../../test/cacheSession";
import { fakeObserver, fakeViewport, hardWordOf, pageOf } from "../../test/pagedApi";
import { HardWordsPage } from "./HardWordsPage";

// Hard words show their first 15 at once and load the rest 15 at a time. The header and the drill tabs come from
// the server's summary of the whole list; a drill tab starts again from the first page.

type Query = { drill?: string; cursor?: string; limit?: number };

const PAST = "2020-01-01T00:00:00.000Z";
const FUTURE = "2099-01-01T00:00:00.000Z";

// 40 hard words: the even ones are hard in term_meaning, the odd ones in reading_term; the first 12 are due.
const ALL = Array.from({ length: 40 }, (_, i) => hardWordOf(i, i % 2 === 0 ? "term_meaning" : "reading_term", i < 12 ? PAST : FUTURE));

const SUMMARY = {
  total: 40,
  dueToday: 12,
  drills: [
    { drill: "term_meaning", count: 20, termLang: "ja" },
    { drill: "reading_term", count: 20, termLang: "ja" },
  ],
};

let restore: (() => void) | null = null;
let observer: ReturnType<typeof fakeObserver> | null = null;
let viewport: ReturnType<typeof fakeViewport> | null = null;

afterEach(() => {
  restore?.();
  observer?.restore();
  viewport?.restore();
  restore = null;
  observer = null;
  viewport = null;
  window.history.replaceState(null, "", "/");
});

const serve = () => {
  const requests: Query[] = [];

  const api = cacheSession("PF", {
    "me.get": () => ({ settings: { defaultSessionSize: 10 } }),
    "study.hardWords": (request: { query: Query }) => {
      requests.push(request.query);

      const matching = ALL.filter((word) => request.query.drill === undefined || word.cards.some((card) => card.drill === request.query.drill));

      return { ...pageOf(matching, request.query), summary: SUMMARY };
    },
  });
  restore = api.restore;

  return requests;
};

const rows = () => within(screen.getByRole("list", { name: "Hard words" })).getAllByRole("listitem");

describe("the Hard words page pages", () => {
  test("shows its first 15 at once, without asking for the rest", async () => {
    const requests = serve();
    render(<HardWordsPage />);

    await screen.findByRole("list", { name: "Hard words" });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(rows()).toHaveLength(15);
    expect(requests).toEqual([{ limit: 15 }]);
  });

  test("the header counts every hard word, from the summary", async () => {
    serve();
    render(<HardWordsPage />);

    await screen.findByRole("list", { name: "Hard words" });

    expect(screen.getByText("40 words")).toBeDefined();
    expect(screen.getByText("12 due today")).toBeDefined();
    expect(screen.getByRole("button", { name: /Study hard words/ }).hasAttribute("disabled")).toBe(false);
  });

  test("the drill tabs come from the summary", async () => {
    serve();
    render(<HardWordsPage />);

    await screen.findByRole("list", { name: "Hard words" });

    const tabs = within(screen.getByRole("tablist", { name: "Drill" })).getAllByRole("tab");

    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "All",
      drillLabel("ja", "term_meaning"),
      drillLabel("ja", "reading_term"),
    ]);
  });

  test("shows 30 and then 40 with Load more, none twice", async () => {
    const requests = serve();
    const user = userEvent.setup();
    render(<HardWordsPage />);

    await screen.findByRole("list", { name: "Hard words" });
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows()).toHaveLength(30));
    expect(requests[1]).toEqual({ limit: 15, cursor: "15" });

    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows()).toHaveLength(40));

    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(screen.getByText("40 words")).toBeDefined();
  });

  test("on a phone, loads the next page by itself when the end scrolls into view", async () => {
    observer = fakeObserver();
    viewport = fakeViewport(true);
    serve();
    render(<HardWordsPage />);

    await screen.findByRole("list", { name: "Hard words" });
    observer.intersect();

    await waitFor(() => expect(rows()).toHaveLength(30));
  });

  test("a drill tab starts again from the first page of that drill", async () => {
    const requests = serve();
    const user = userEvent.setup();
    render(<HardWordsPage />);

    await screen.findByRole("list", { name: "Hard words" });
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows()).toHaveLength(30));

    await user.click(screen.getByRole("tab", { name: new RegExp(drillLabel("ja", "reading_term")) }));

    await waitFor(() => expect(requests.at(-1)).toEqual({ drill: "reading_term", limit: 15 }));
    await waitFor(() => expect(rows()).toHaveLength(15));
    expect(screen.getByText("40 words")).toBeDefined();
    expect(screen.getByRole("button", { name: "Load more" })).toBeDefined();
  });
});
