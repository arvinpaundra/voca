import { afterEach, describe, expect, test } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DeckDetail } from "@voca/contract";
import { cacheSession } from "../../test/cacheSession";
import { fakeObserver, fakeViewport, listedWord, pad, pageOf } from "../../test/pagedApi";
import { DeckView } from "./DeckView";

// A deck's words load 15 at a time; a search starts again from the first page.

type Request = { params: { deckSlug: string }; query: { q?: string; cursor?: string; limit?: number } };

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
});

const serve = () => {
  const requests: Request["query"][] = [];

  const api = cacheSession("PF", {
    "me.get": () => ({ settings: { timezone: "UTC" } }),
    "insight.deckStats": () => stats,
    "library.listWords": (request: Request) => {
      requests.push(request.query);

      const matching = ALL.filter((word) => request.query.q === undefined || word.term.includes(request.query.q));

      return pageOf(matching, request.query);
    },
  });
  restore = api.restore;

  return requests;
};

const rows = () => within(screen.getByRole("list", { name: "Words" })).getAllByRole("listitem");

describe("a deck's words page", () => {
  test("shows 15 words, then 30, then 40, with none twice", async () => {
    const requests = serve();
    const user = userEvent.setup();
    render(<DeckView deck={deck} />);

    await screen.findByRole("button", { name: "Open 語00" });

    expect(rows()).toHaveLength(15);
    expect(requests).toEqual([{ limit: 15 }]);

    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows()).toHaveLength(30));
    expect(requests[1]).toEqual({ limit: 15, cursor: "15" });

    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows()).toHaveLength(40));

    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Open 語/ })).toHaveLength(40);
  });

  test("on a phone, loads the next page by itself when the end scrolls into view", async () => {
    observer = fakeObserver();
    viewport = fakeViewport(true);
    serve();
    render(<DeckView deck={deck} />);

    await screen.findByRole("button", { name: "Open 語00" });
    observer.intersect();

    await waitFor(() => expect(rows()).toHaveLength(30));
  });

  test("a search starts again from the first page", async () => {
    const requests = serve();
    const user = userEvent.setup();
    render(<DeckView deck={deck} />);

    await screen.findByRole("button", { name: "Open 語00" });
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows()).toHaveLength(30));

    await user.type(screen.getByLabelText("Search words"), "語3");

    await waitFor(() => expect(requests.at(-1)).toEqual({ q: "語3", limit: 15 }));
    await waitFor(() => expect(rows()).toHaveLength(10));
    expect(screen.getByRole("button", { name: `Open 語${pad(30)}` })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });
});
