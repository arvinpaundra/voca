import { afterEach, describe, expect, test } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DeckSlug, DeckSummary, PublicDeck, PublicDeckDetail } from "@voca/contract";
import { communityQuery, decksQuery, meQuery, publicDeckQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { cacheSession } from "../../test/cacheSession";
import { DeckPreviewPage } from "../discover/DeckPreviewPage";
import { DiscoverPage } from "../discover/DiscoverPage";
import { DecksPage } from "./DecksPage";

// The library and Community pages read through the shared query cache: a page whose data is cached renders it at
// once, with no request, and a write refreshes what it changed.

const deck = (slug: string, title: string) =>
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
    snooze: null,
    wordCount: 12,
    dueCount: 3,
  }) as unknown as DeckSummary;

const DECKS = [deck("DECK000001", "Japanese N5 verbs"), deck("DECK000004", "Mandarin HSK 1")];

const me = { name: "Arvin Paundra", settings: { timezone: "UTC", dayStartHour: 4, defaultSessionSize: 10 } };

const publicDeck = {
  slug: "DECK000007",
  title: "JLPT Core 800",
  description: "",
  termLang: "ja",
  meaningLang: "en",
  publishedAt: "2026-10-01T00:00:00.000Z",
  forkCount: 1200,
  wordCount: 800,
  owner: { name: "Mika T.", avatarUrl: null },
} as unknown as PublicDeck;

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
});

describe("cached pages", () => {
  test("the decks list renders the cached decks without a request", async () => {
    queryClient.setQueryData(decksQuery().queryKey, DECKS);
    queryClient.setQueryData(meQuery().queryKey, me as never);
    const api = cacheSession("QL");
    restore = api.restore;

    render(<DecksPage />);
    await api.expectNoReads("DecksPage");

    expect(screen.getByRole("link", { name: "Japanese N5 verbs" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Mandarin HSK 1" })).toBeTruthy();
  });

  test("Discover renders the cached first page without a request", async () => {
    // Discover opens on every language, no search, newest first.
    queryClient.setQueryData(communityQuery({ sort: "new" }).queryKey, {
      pages: [{ items: [publicDeck], nextCursor: null }],
      pageParams: [undefined],
    } as never);
    const api = cacheSession("QL");
    restore = api.restore;

    render(<DiscoverPage />);
    await api.expectNoReads("DiscoverPage");

    expect(within(screen.getByRole("list", { name: "Community decks" })).getByRole("link", { name: "JLPT Core 800" })).toBeTruthy();
  });

  test("a Community deck preview renders the cached deck without a request", async () => {
    const detail = { ...publicDeck, preview: [] } as unknown as PublicDeckDetail;
    queryClient.setQueryData(publicDeckQuery("DECK000007" as DeckSlug).queryKey, detail);
    const api = cacheSession("QL");
    restore = api.restore;

    render(<DeckPreviewPage deckSlug="DECK000007" />);
    await api.expectNoReads("DeckPreviewPage");

    expect(screen.getByRole("heading", { name: "JLPT Core 800" })).toBeTruthy();
  });
});

describe("writes", () => {
  test("snoozing selected decks refreshes the cached list", async () => {
    queryClient.setQueryData(decksQuery().queryKey, DECKS);
    queryClient.setQueryData(meQuery().queryKey, me as never);
    const user = userEvent.setup();
    const api = cacheSession("QL", {
      "library.snoozeDecks": () => [{ ...DECKS[0], snooze: { until: null } }],
      "library.listDecks": () => DECKS,
      "me.get": () => me,
    });
    restore = api.restore;

    render(<DecksPage />);
    await api.expectNoReads("DecksPage");

    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(screen.getByRole("checkbox", { name: "Select Japanese N5 verbs" }));
    await user.click(within(screen.getByRole("region", { name: "Selected decks" })).getByRole("button", { name: "Snooze" }));
    await user.click(within(screen.getByRole("dialog", { name: "Snooze deck" })).getByRole("button", { name: "3 days" }));

    await waitFor(() => expect(api.calls).toContain("library.listDecks"));
    expect(api.calls[0]).toBe("library.snoozeDecks");
  });
});
