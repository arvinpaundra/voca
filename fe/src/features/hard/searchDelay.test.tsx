import { afterEach, describe, expect, test } from "bun:test";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { drillLabel } from "@voca/contract";
import { cacheSession } from "../../test/cacheSession";
import { hardWordOf, pageOf } from "../../test/pagedApi";
import { HardWordsPage } from "./HardWordsPage";

// Hard words has a search box that finds words by term or meaning. It shows each keystroke at once and asks the
// server 500 ms after the last one; Enter and an emptied box ask at once. It works with the drill tabs, which apply
// immediately, and a new search starts again from the first page.

type Query = { drill?: string; q?: string; cursor?: string; limit?: number };

const PAST = "2020-01-01T00:00:00.000Z";

// 40 hard words: the even ones are hard in term_meaning, the odd ones in reading_term.
const ALL = Array.from({ length: 40 }, (_, i) => hardWordOf(i, i % 2 === 0 ? "term_meaning" : "reading_term", PAST));

// The summary covers every hard word, whatever the search.
const SUMMARY = {
  total: 40,
  dueToday: 40,
  drills: [
    { drill: "term_meaning", count: 20, termLang: "ja" },
    { drill: "reading_term", count: 20, termLang: "ja" },
  ],
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
  window.history.replaceState(null, "", "/");
});

const serve = () => {
  const requests: Query[] = [];

  const api = cacheSession("HF", {
    "me.get": () => ({ settings: { defaultSessionSize: 10 } }),
    "study.hardWords": (request: { query: Query }) => {
      requests.push(request.query);

      const { drill, q } = request.query;
      const matching = ALL.filter((word) => drill === undefined || word.cards.some((card) => card.drill === drill)).filter(
        (word) => q === undefined || word.term.includes(q) || word.meaning.includes(q),
      );

      return { ...pageOf(matching, request.query), summary: SUMMARY };
    },
  });
  restore = api.restore;

  return requests;
};

const searches = (requests: Query[]) => requests.filter((request) => request.q !== undefined);

const rows = () => within(screen.getByRole("list", { name: "Hard words" })).getAllByRole("listitem");

const open = async () => {
  render(<HardWordsPage />);
  await screen.findByRole("list", { name: "Hard words" });

  return screen.getByRole("searchbox", { name: "Search hard words" }) as HTMLInputElement;
};

describe("the Hard words search", () => {
  test("typing '語1' with 100 ms between keys sends one search, 500 ms after the last key", async () => {
    const requests = serve();
    const user = userEvent.setup({ delay: 100 });
    const box = await open();

    await user.type(box, "語1");
    const typedAt = Date.now();

    await act(() => wait(300));

    expect(box.value).toBe("語1");
    expect(searches(requests)).toEqual([]);
    expect(rows()).toHaveLength(15);

    await waitFor(() => expect(rows()).toHaveLength(10), { timeout: 1500 });

    expect(searches(requests).map((request) => request.q)).toEqual(["語1"]);
    expect(Date.now() - typedAt).toBeGreaterThanOrEqual(450);
    expect(screen.getByRole("searchbox", { name: "Search hard words" })).toBe(box);
  });

  test("the header and the tabs keep counting every hard word while a search is shown", async () => {
    serve();
    const user = userEvent.setup();
    const box = await open();

    await user.type(box, "語1{Enter}");
    await waitFor(() => expect(rows()).toHaveLength(10), { timeout: 300 });

    expect(screen.getByText("40 words")).toBeDefined();
    expect(within(screen.getByRole("tablist", { name: "Drill" })).getAllByRole("tab")).toHaveLength(3);
  });

  test("Enter sends the search without waiting", async () => {
    const requests = serve();
    const user = userEvent.setup();
    const box = await open();

    await user.type(box, "語1{Enter}");

    await waitFor(() => expect(rows()).toHaveLength(10), { timeout: 300 });
    expect(searches(requests).map((request) => request.q)).toEqual(["語1"]);
  });

  test("emptying the box brings the whole list back without waiting", async () => {
    serve();
    const user = userEvent.setup();
    const box = await open();

    await user.type(box, "語1{Enter}");
    await waitFor(() => expect(rows()).toHaveLength(10), { timeout: 300 });

    await user.clear(box);

    await waitFor(() => expect(rows()).toHaveLength(15), { timeout: 300 });
  });

  test("finds a word by its meaning", async () => {
    const requests = serve();
    const user = userEvent.setup();
    const box = await open();

    await user.type(box, "meaning 07{Enter}");

    await waitFor(() => expect(rows()).toHaveLength(1), { timeout: 300 });
    expect(searches(requests).map((request) => request.q)).toEqual(["meaning 07"]);
  });

  test("works together with a drill tab, which applies at once", async () => {
    const requests = serve();
    const user = userEvent.setup();
    const box = await open();

    await user.click(screen.getByRole("tab", { name: drillLabel("ja", "reading_term") }));
    await waitFor(() => expect(requests.at(-1)).toEqual({ drill: "reading_term", limit: 15 }), { timeout: 300 });

    await user.type(box, "語1{Enter}");

    // Of 語10 to 語19, the odd ones are hard in reading_term.
    await waitFor(() => expect(rows()).toHaveLength(5), { timeout: 300 });
    expect(requests.at(-1)).toEqual({ drill: "reading_term", q: "語1", limit: 15 });
  });

  test("a search starts again from the first page", async () => {
    const requests = serve();
    const user = userEvent.setup();
    const box = await open();

    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows()).toHaveLength(30));

    await user.type(box, "語1{Enter}");

    await waitFor(() => expect(searches(requests)).toHaveLength(1));
    expect(searches(requests)[0]).toEqual({ q: "語1", limit: 15 });
  });
});
