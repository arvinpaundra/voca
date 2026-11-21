import { afterEach, describe, expect, test } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DeckDetail, DeckSlug, Word, WordSlug } from "@voca/contract";
import { deckDrillsQuery, deckQuery, deckStatsQuery, meQuery, wordsQuery, wordStatsQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { cacheSession } from "../../test/cacheSession";
import { FlashcardsPage } from "../flashcards/FlashcardsPage";
import { WordPage } from "../word/WordPage";
import { DeckPage } from "./DeckPage";

// The deck page, the word page and the flashcards page read through the shared query cache: a page whose data is
// cached renders it at once, with no request, and a write refreshes what it changed.

const DECK = "DECK000001" as DeckSlug;
const WORD = "WRD000000003" as WordSlug;

const deck = {
  slug: DECK,
  title: "Japanese N5 verbs",
  description: "",
  termLang: "ja",
  meaningLang: "en",
  visibility: "private",
  publishedAt: null,
  forkedFrom: null,
  forkCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  snooze: null,
  wordCount: 1,
  dueCount: 0,
} as unknown as DeckDetail;

const word = {
  slug: WORD,
  term: "ありがとう",
  reading: null,
  meaning: "thank you",
  example: null,
  notes: null,
  createdAt: "2026-11-01T00:00:00.000Z",
} as unknown as Word;

const me = { name: "Arvin Paundra", settings: { timezone: "UTC", dayStartHour: 4, defaultSessionSize: 10 } };

const deckStats = {
  maturity: { new: 1, learning: 0, mature: 0 },
  dueToday: 0,
  overdue: 0,
  forecast: [],
  trueRetention: null,
  calibration: null,
  reviewsPerDay: [],
};

const wordsPage = { pages: [{ items: [{ ...word, cards: [] }], nextCursor: null }], pageParams: [undefined] };

const seedDeckPage = () => {
  queryClient.setQueryData(deckQuery(DECK).queryKey, deck);
  queryClient.setQueryData(meQuery().queryKey, me as never);
  queryClient.setQueryData(deckStatsQuery(DECK).queryKey, deckStats as never);
  // The deck page opens with an empty search, so its first words page is keyed by the empty filter.
  queryClient.setQueryData(wordsQuery(DECK, {}).queryKey, wordsPage as never);
};

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
});

describe("cached pages", () => {
  test("the deck page renders the cached deck, stats and words without a request", async () => {
    seedDeckPage();
    const api = cacheSession("QD");
    restore = api.restore;

    render(<DeckPage deckSlug={DECK} />);
    await api.expectNoReads("DeckPage");

    expect(screen.getByRole("heading", { name: "Japanese N5 verbs" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open ありがとう" })).toBeTruthy();
  });

  test("the word page renders the cached deck, stats and drills without a request", async () => {
    queryClient.setQueryData(deckQuery(DECK).queryKey, deck);
    queryClient.setQueryData(meQuery().queryKey, me as never);
    queryClient.setQueryData(wordStatsQuery(WORD).queryKey, { word, drills: [] } as never);
    queryClient.setQueryData(deckDrillsQuery(DECK).queryKey, []);
    const api = cacheSession("QD");
    restore = api.restore;

    render(<WordPage deckSlug={DECK} wordSlug={WORD} />);
    await api.expectNoReads("WordPage");

    expect(screen.getAllByText("ありがとう").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Edit word" })).toBeTruthy();
  });

  test("the flashcards page renders the cached deck without a request", async () => {
    queryClient.setQueryData(deckQuery(DECK).queryKey, deck);
    const api = cacheSession("QD");
    restore = api.restore;

    render(<FlashcardsPage deckSlug={DECK} />);
    await api.expectNoReads("FlashcardsPage");

    expect(screen.getByText("Japanese N5 verbs")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start flashcards" })).toBeTruthy();
  });

  test("the word modal renders the cached stats without a request", async () => {
    seedDeckPage();
    queryClient.setQueryData(wordStatsQuery(WORD).queryKey, { word, drills: [] } as never);
    const user = userEvent.setup();
    const api = cacheSession("QD");
    restore = api.restore;

    render(<DeckPage deckSlug={DECK} />);
    await api.expectNoReads("DeckPage");
    await user.click(screen.getByRole("button", { name: "Open ありがとう" }));
    await api.expectNoReads("WordDetailsModal");

    expect(screen.getByRole("dialog", { name: "ありがとう" })).toBeTruthy();
  });
});

describe("writes", () => {
  test("snoozing the deck refreshes the cached deck", async () => {
    seedDeckPage();
    const user = userEvent.setup();
    const snoozed = { ...deck, snooze: { until: null } };
    const api = cacheSession("QD", {
      "library.snoozeDecks": () => [snoozed],
      "library.getDeck": () => snoozed,
      "library.listWords": () => wordsPage.pages[0],
      "insight.deckStats": () => deckStats,
      "me.get": () => me,
    });
    restore = api.restore;

    render(<DeckPage deckSlug={DECK} />);
    await api.expectNoReads("DeckPage");

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Snooze deck" }));
    await user.click(within(screen.getByRole("dialog", { name: "Snooze deck" })).getByRole("button", { name: "Until I unsnooze" }));

    await waitFor(() => expect(api.calls).toContain("library.getDeck"));
    expect(api.calls[0]).toBe("library.snoozeDecks");
  });
});
