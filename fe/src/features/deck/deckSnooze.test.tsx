import { describe, expect, mock, spyOn, test } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateTime, Effect, Result } from "effect";
import type { DeckDetail, DeckSnooze } from "@voca/contract";
import type { ApiClient } from "../../lib/api";
import { session } from "../../lib/appSession";
import { DeckView } from "./DeckView";

// The deck page's snooze: the header badge, and Snooze or Unsnooze in the ⋯ menu for this one deck.

const SLUG = "DECK000001";

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

// The words load after the first render; waiting for the empty list keeps that update inside the test.
const renderDeck = async (deck: DeckDetail, onDeckChanged: (deck: DeckDetail) => void) => {
  render(<DeckView deck={deck} onDeckChanged={onDeckChanged} />);

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

// A fake API client: `snoozeDecks` and `unsnoozeDecks` record their payload and answer with the deck, snoozed or not.
const fakeSession = (answer: (endpoint: string) => unknown) => {
  const requests: { endpoint: string; payload: unknown }[] = [];

  const endpoint = (name: string) => (request: { payload?: unknown }) => {
    requests.push({ endpoint: name, payload: request?.payload });

    return Effect.succeed(answer(name) as never);
  };

  const client = {
    library: {
      listWords: () => Effect.succeed({ items: [], nextCursor: null } as never),
      snoozeDecks: endpoint("snoozeDecks"),
      unsnoozeDecks: endpoint("unsnoozeDecks"),
    },
    insight: { deckStats: () => Effect.succeed(stats as never) },
    me: { get: () => Effect.succeed({ settings: { timezone: "UTC" } } as never) },
  };

  return spyOn(session, "call").mockImplementation(async (f) =>
    Result.succeed(await Effect.runPromise(f(client as unknown as ApiClient))),
  );
};

describe("DeckView snooze", () => {
  test("a snoozed deck shows its end in the header", async () => {
    const spy = fakeSession(() => []);
    await renderDeck(deckWith({ until: DateTime.makeUnsafe("2026-11-28T04:00:00.000Z") }), () => {});
    expect(screen.getByText("Snoozed until Sat 28 Nov").classList.contains("badge")).toBe(true);

    spy.mockRestore();
  });

  test("the ⋯ menu offers Unsnooze for a snoozed deck and saves it", async () => {
    const user = userEvent.setup();
    const onDeckChanged = mock((_deck: DeckDetail) => {});
    const spy = fakeSession(() => [{ ...deckWith(null), snooze: null }]);
    await renderDeck(deckWith({ until: null }), onDeckChanged);

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Unsnooze deck" }));

    await waitFor(() => expect(onDeckChanged).toHaveBeenCalledTimes(1));
    expect(onDeckChanged.mock.calls[0]?.[0]?.snooze).toBeNull();

    spy.mockRestore();
  });

  test("the ⋯ menu snoozes an awake deck for the chosen days", async () => {
    const user = userEvent.setup();
    const onDeckChanged = mock((_deck: DeckDetail) => {});
    const spy = fakeSession(() => [
      { ...deckWith(null), snooze: { until: DateTime.makeUnsafe("2026-11-28T04:00:00.000Z") } },
    ]);
    await renderDeck(deckWith(null), onDeckChanged);

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Snooze deck" }));
    await user.click(within(screen.getByRole("dialog", { name: "Snooze deck" })).getByRole("button", { name: "7 days" }));

    await waitFor(() => expect(onDeckChanged).toHaveBeenCalledTimes(1));
    expect(onDeckChanged.mock.calls[0]?.[0]?.snooze).toEqual({ until: DateTime.makeUnsafe("2026-11-28T04:00:00.000Z") });

    spy.mockRestore();
  });

  test("the header links to the deck's flashcards", async () => {
    const spy = fakeSession(() => []);
    await renderDeck(deckWith(null), () => {});

    const link = screen.getByRole("link", { name: "Flashcards" });
    expect(link.getAttribute("href")).toBe(`/app/decks/${SLUG}/flashcards`);

    spy.mockRestore();
  });
});
