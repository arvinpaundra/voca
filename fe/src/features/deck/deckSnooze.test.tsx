import { describe, expect, spyOn, test } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateTime, Effect, Result } from "effect";
import type { DeckDetail, DeckSlug, DeckSnooze } from "@voca/contract";
import type { ApiClient } from "../../lib/api";
import { session } from "../../lib/appSession";
import { deckQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { DeckPage } from "./DeckPage";

// The deck page's snooze: the header badge, and Snooze or Unsnooze in the ⋯ menu for this one deck.

const SLUG = "DECK000001" as DeckSlug;

const deckWith = (snooze: DeckSnooze | null): DeckDetail =>
  ({
    slug: SLUG,
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
    snooze,
    wordCount: 12,
    dueCount: 3,
  }) as unknown as DeckDetail;

// The deck page reads the deck from the cache; the words load after the first render, so waiting for the empty
// list keeps that update inside the test.
const renderDeck = async (deck: DeckDetail) => {
  queryClient.setQueryData(deckQuery(SLUG).queryKey, deck);

  render(<DeckPage deckSlug={SLUG} />);

  await screen.findByText("No words yet");
};

const stats = {
  maturity: { new: 0, learning: 0, mature: 0 },
  dueToday: 3,
  overdue: 0,
  forecast: [],
  trueRetention: 0.88,
  calibration: null,
  reviewsPerDay: [],
};

// A fake API client whose deck lives in the fake: a write saves `after`, and the refetch that follows reads it back.
const fakeSession = (after: DeckDetail) => {
  let current: DeckDetail | null = null;
  const requests: string[] = [];

  const write = (name: string) => () => {
    requests.push(name);
    current = after;

    return Effect.succeed([after] as never);
  };

  const client = {
    library: {
      getDeck: () => {
        requests.push("getDeck");

        return Effect.succeed(current as never);
      },
      listWords: () => Effect.succeed({ items: [], nextCursor: null } as never),
      snoozeDecks: write("snoozeDecks"),
      unsnoozeDecks: write("unsnoozeDecks"),
    },
    insight: { deckStats: () => Effect.succeed(stats as never) },
    me: { get: () => Effect.succeed({ settings: { timezone: "UTC" } } as never) },
  };

  const spy = spyOn(session, "call").mockImplementation(async (f) =>
    Result.succeed(await Effect.runPromise(f(client as unknown as ApiClient))),
  );

  return { requests, spy };
};

describe("DeckPage snooze", () => {
  test("a snoozed deck shows its end in the header", async () => {
    const { spy } = fakeSession(deckWith(null));
    await renderDeck(deckWith({ until: DateTime.makeUnsafe("2026-11-28T04:00:00.000Z") }));

    expect(screen.getByText("Snoozed until Sat 28 Nov").classList.contains("badge")).toBe(true);

    spy.mockRestore();
  });

  test("the ⋯ menu offers Unsnooze for a snoozed deck and saves it", async () => {
    const user = userEvent.setup();
    const { requests, spy } = fakeSession(deckWith(null));
    await renderDeck(deckWith({ until: null }));

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Unsnooze deck" }));

    await waitFor(() => expect(requests).toEqual(["unsnoozeDecks", "getDeck"]));
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menuitem", { name: "Snooze deck" })).toBeTruthy();

    spy.mockRestore();
  });

  test("the ⋯ menu snoozes an awake deck for the chosen days", async () => {
    const user = userEvent.setup();
    const snoozed = deckWith({ until: DateTime.makeUnsafe("2026-11-28T04:00:00.000Z") });
    const { requests, spy } = fakeSession(snoozed);
    await renderDeck(deckWith(null));

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Snooze deck" }));
    await user.click(within(screen.getByRole("dialog", { name: "Snooze deck" })).getByRole("button", { name: "7 days" }));

    expect(await screen.findByText("Snoozed until Sat 28 Nov")).toBeTruthy();
    expect(requests).toEqual(["snoozeDecks", "getDeck"]);

    spy.mockRestore();
  });

  test("the header links to the deck's flashcards", async () => {
    const { spy } = fakeSession(deckWith(null));
    await renderDeck(deckWith(null));

    const link = screen.getByRole("link", { name: "Flashcards" });
    expect(link.getAttribute("href")).toBe(`/app/decks/${SLUG}/flashcards`);

    spy.mockRestore();
  });
});
