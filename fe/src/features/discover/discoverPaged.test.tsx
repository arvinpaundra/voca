import { afterEach, describe, expect, test } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cacheSession } from "../../test/cacheSession";
import { fakeObserver, pageOf, publicDeck } from "../../test/pagedApi";
import { DiscoverPage } from "./DiscoverPage";

// Discover loads its decks 15 at a time; a language change starts again from the first page.

type Query = { q?: string; termLang?: string; sort?: string; cursor?: string; limit?: number };

// 40 public decks: the even ones are Japanese, the odd ones Mandarin.
const ALL = Array.from({ length: 40 }, (_, i) => publicDeck(i, i % 2 === 0 ? "ja" : "zh"));

let restore: (() => void) | null = null;
let observer: ReturnType<typeof fakeObserver> | null = null;

afterEach(() => {
  restore?.();
  observer?.restore();
  restore = null;
  observer = null;
});

const serve = () => {
  const requests: Query[] = [];

  const api = cacheSession("PF", {
    "community.list": (request: { query: Query }) => {
      requests.push(request.query);

      const matching = ALL.filter((deck) => request.query.termLang === undefined || deck.termLang === request.query.termLang);

      return pageOf(matching, request.query);
    },
  });
  restore = api.restore;

  return requests;
};

const rows = () => within(screen.getByRole("list", { name: "Community decks" })).getAllByRole("listitem");

const titles = () => rows().map((row) => within(row).getAllByRole("link")[0]!.textContent);

describe("Discover pages", () => {
  test("shows 15 decks, then 30, then 40, with none twice", async () => {
    const requests = serve();
    const user = userEvent.setup();
    render(<DiscoverPage />);

    await screen.findByText("Public 00");

    expect(rows()).toHaveLength(15);
    expect(requests).toEqual([{ sort: "new", limit: 15 }]);

    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows()).toHaveLength(30));
    expect(requests[1]).toEqual({ sort: "new", limit: 15, cursor: "15" });

    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows()).toHaveLength(40));

    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(new Set(titles()).size).toBe(40);
  });

  test("loads the next page by itself when the end scrolls into view", async () => {
    observer = fakeObserver();
    serve();
    render(<DiscoverPage />);

    await screen.findByText("Public 00");
    observer.intersect();

    await waitFor(() => expect(rows()).toHaveLength(30));
  });

  test("changing the language starts again from the first 15 matches", async () => {
    const requests = serve();
    const user = userEvent.setup();
    render(<DiscoverPage />);

    await screen.findByText("Public 00");
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows()).toHaveLength(30));

    await user.selectOptions(screen.getByRole("combobox", { name: "Term language" }), "zh");

    await waitFor(() => expect(requests.at(-1)).toEqual({ termLang: "zh", sort: "new", limit: 15 }));
    await waitFor(() => expect(rows()).toHaveLength(15));
    expect(titles()[0]).toBe("Public 01");
    expect(screen.getByRole("button", { name: "Load more" })).toBeDefined();
  });
});
