import { afterEach, describe, expect, test } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DeckSort } from "@voca/contract";
import { cacheSession } from "../../test/cacheSession";
import { deckSummary, fakeObserver, pad, pageOf } from "../../test/pagedApi";
import { DecksPage } from "./DecksPage";

// The library loads its decks 15 at a time, in the order the server gives; search, language and sort are the
// server's, and each starts again from the first page. "N decks" counts the whole library.

type Request = { query: { q?: string; termLang?: string; sort?: DeckSort; cursor?: string; limit?: number } };

// 40 decks: every fourth one is Mandarin.
const ALL = Array.from({ length: 40 }, (_, i) => deckSummary(i, i % 4 === 3 ? "zh" : "ja"));

const me = { name: "Arvin Paundra", settings: { timezone: "UTC", dayStartHour: 4, defaultSessionSize: 10 } };

let restore: (() => void) | null = null;
let observer: ReturnType<typeof fakeObserver> | null = null;

afterEach(() => {
  restore?.();
  observer?.restore();
  restore = null;
  observer = null;
});

/** The server: filters by title and language, keeps the order, pages by cursor; `total` and `termLangs` are the library's. */
const serve = (all = ALL, page: (items: typeof ALL, request: Request) => ReturnType<typeof pageOf<(typeof ALL)[number]>> = (items, request) => pageOf(items, request.query)) => {
  const requests: Request["query"][] = [];

  const api = cacheSession("PF", {
    "me.get": () => me,
    "library.listDecks": (request: Request) => {
      requests.push(request.query);

      const q = request.query.q?.toLowerCase();
      const matching = all
        .filter((deck) => q === undefined || deck.title.toLowerCase().includes(q))
        .filter((deck) => request.query.termLang === undefined || deck.termLang === request.query.termLang);

      return { ...page(matching, request), total: all.length, termLangs: ["ja", "zh"].filter((lang) => all.some((deck) => deck.termLang === lang)) };
    },
  });
  restore = api.restore;

  return requests;
};

const rows = () => within(screen.getByRole("list", { name: "Decks" })).getAllByRole("listitem");

const titles = () => rows().map((row) => within(row).getAllByRole("link")[0]!.textContent);

describe("the library pages", () => {
  test("shows 15 decks, then 30, then 40, with none twice, and counts every deck", async () => {
    const requests = serve();
    const user = userEvent.setup();
    render(<DecksPage />);

    await screen.findByText("Deck 00");

    expect(rows()).toHaveLength(15);
    expect(screen.getByText("40 decks")).toBeDefined();
    expect(requests).toEqual([{ sort: "due", limit: 15 }]);

    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows()).toHaveLength(30));
    expect(requests[1]).toEqual({ sort: "due", limit: 15, cursor: "15" });

    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows()).toHaveLength(40));

    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(new Set(titles()).size).toBe(40);
    expect(titles()).toEqual(ALL.map((deck) => deck.title));
    expect(screen.getByText("40 decks")).toBeDefined();
  });

  test("loads the next page by itself when the end scrolls into view", async () => {
    observer = fakeObserver();
    serve();
    render(<DecksPage />);

    await screen.findByText("Deck 00");
    observer.intersect();

    await waitFor(() => expect(rows()).toHaveLength(30));
  });

  test("a deck a later page repeats is shown once", async () => {
    // The next page starts with the last deck of the first one, as when a deck was added in between.
    serve(ALL, (items, request) => {
      const start = request.query.cursor === undefined ? 0 : Number(request.query.cursor) - 1;

      return pageOf(items, { ...request.query, cursor: String(start) });
    });
    const user = userEvent.setup();
    render(<DecksPage />);

    await screen.findByText("Deck 00");
    await user.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => expect(rows()).toHaveLength(29));
    expect(new Set(titles()).size).toBe(29);
  });

  test("a search asks the server and starts again from the first page", async () => {
    const requests = serve();
    const user = userEvent.setup();
    render(<DecksPage />);

    await screen.findByText("Deck 00");
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows()).toHaveLength(30));

    await user.type(screen.getByLabelText("Search decks"), "Deck 3");

    await waitFor(() => expect(requests.at(-1)).toEqual({ q: "Deck 3", sort: "due", limit: 15 }));
    await waitFor(() => expect(titles()).toEqual(Array.from({ length: 10 }, (_, i) => `Deck ${pad(30 + i)}`)));
    expect(screen.getByText("40 decks")).toBeDefined();
  });

  test("the language filter starts again from the first page, with the languages of the whole library", async () => {
    const requests = serve();
    const user = userEvent.setup();
    render(<DecksPage />);

    await screen.findByText("Deck 00");
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows()).toHaveLength(30));

    const language = screen.getByRole("combobox", { name: "Term language" });
    expect([...language.querySelectorAll("option")].map((option) => option.textContent)).toEqual(["All languages", "ja", "zh"]);

    await user.selectOptions(language, "zh");

    await waitFor(() => expect(requests.at(-1)).toEqual({ termLang: "zh", sort: "due", limit: 15 }));
    await waitFor(() => expect(rows()).toHaveLength(10));
    expect(titles().every((title) => ALL.find((deck) => deck.title === title)?.termLang === "zh")).toBe(true);
  });

  test("the sort starts again from the first page", async () => {
    const requests = serve();
    const user = userEvent.setup();
    render(<DecksPage />);

    await screen.findByText("Deck 00");
    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows()).toHaveLength(30));

    await user.selectOptions(screen.getByRole("combobox", { name: "Sort" }), "title");

    await waitFor(() => expect(requests.at(-1)).toEqual({ sort: "title", limit: 15 }));
    await waitFor(() => expect(rows()).toHaveLength(15));
  });

  test("select all selects only the decks loaded so far", async () => {
    serve();
    const user = userEvent.setup();
    render(<DecksPage />);

    await screen.findByText("Deck 00");
    expect(screen.queryByRole("button", { name: "Select all" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(screen.getByRole("button", { name: "Select all" }));

    expect(screen.getByText("15 selected")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows()).toHaveLength(30));
    await user.click(screen.getByRole("button", { name: "Select all" }));

    expect(screen.getByText("30 selected")).toBeDefined();
  });

  test("an empty library says so", async () => {
    serve([]);
    render(<DecksPage />);

    await screen.findByText("No decks yet");

    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });
});
