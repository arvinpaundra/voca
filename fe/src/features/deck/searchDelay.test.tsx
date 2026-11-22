import { afterEach, describe, expect, test } from "bun:test";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DeckDetail } from "@voca/contract";
import { cacheSession } from "../../test/cacheSession";
import { listedWord, pageOf } from "../../test/pagedApi";
import { DeckView } from "./DeckView";

// A deck's word search shows each keystroke at once and asks the server 500 ms after the last one; Enter and an
// emptied box ask at once. The list on screen stays as it is until the search is sent.

type Query = { q?: string; cursor?: string; limit?: number };

const deck = {
  slug: "DECK000001",
  title: "Japanese N5 verbs",
  description: "",
  termLang: "ja",
  meaningLang: "en",
  visibility: "private",
  publishedAt: null,
  forkedFrom: null,
  forkCount: 0,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  snooze: null,
  wordCount: 40,
  dueCount: 0,
} as unknown as DeckDetail;

const stats = {
  maturity: { new: 40, learning: 0, mature: 0 },
  dueToday: 0,
  overdue: 0,
  forecast: [],
  trueRetention: null,
  calibration: null,
  reviewsPerDay: [],
};

const ALL = Array.from({ length: 40 }, (_, i) => listedWord(i));

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
});

const serve = () => {
  const requests: Query[] = [];

  const api = cacheSession("HF", {
    "me.get": () => ({ settings: { timezone: "UTC" } }),
    "insight.deckStats": () => stats,
    "library.listWords": (request: { query: Query }) => {
      requests.push(request.query);

      return pageOf(
        ALL.filter((word) => request.query.q === undefined || word.term.includes(request.query.q)),
        request.query,
      );
    },
  });
  restore = api.restore;

  return requests;
};

const searches = (requests: Query[]) => requests.filter((request) => request.q !== undefined).map((request) => request.q);

const rows = () => within(screen.getByRole("list", { name: "Words" })).getAllByRole("listitem");

const open = async () => {
  render(<DeckView deck={deck} />);
  await screen.findByRole("button", { name: "Open 語00" });

  return screen.getByRole("searchbox", { name: "Search words" }) as HTMLInputElement;
};

describe("a deck's word search", () => {
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

    expect(searches(requests)).toEqual(["語1"]);
    expect(Date.now() - typedAt).toBeGreaterThanOrEqual(380);
    expect(screen.getByRole("searchbox", { name: "Search words" })).toBe(box);
  });

  test("Enter sends the search without waiting", async () => {
    const requests = serve();
    const user = userEvent.setup();
    const box = await open();

    await user.type(box, "語1{Enter}");

    await waitFor(() => expect(rows()).toHaveLength(10), { timeout: 300 });
    expect(searches(requests)).toEqual(["語1"]);
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

  test("a search starts again from the first page", async () => {
    const requests = serve();
    const user = userEvent.setup();
    const box = await open();

    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows()).toHaveLength(30));

    await user.type(box, "語1{Enter}");

    await waitFor(() => expect(searches(requests)).toEqual(["語1"]));
    expect(requests.find((request) => request.q !== undefined)?.cursor).toBeUndefined();
  });
});
