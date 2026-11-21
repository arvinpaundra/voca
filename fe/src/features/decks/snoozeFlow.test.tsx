import { describe, expect, spyOn, test } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Effect, Result } from "effect";
import type { ApiClient } from "../../lib/api";
import { session } from "../../lib/appSession";
import type { DeckSummary } from "@voca/contract";
import { DecksPage } from "./DecksPage";

// The library's bulk snooze: select rows, snooze or unsnooze them together, then reload the list.

const deck = (slug: string, title: string, snooze: DeckSummary["snooze"]) =>
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
    snooze,
    wordCount: 12,
    dueCount: 3,
  }) as unknown as DeckSummary;

const JAPANESE = deck("DECK000001", "Japanese N5 verbs", null);
const MANDARIN = deck("DECK000004", "Mandarin HSK 1", null);

// A fake API client: each endpoint records its payload and answers with the given value.
const fakeSession = (decks: readonly DeckSummary[]) => {
  const requests: { endpoint: string; payload: unknown }[] = [];

  const answer = (endpoint: string, value: unknown) => (request: { payload?: unknown }) => {
    requests.push({ endpoint, payload: request?.payload });

    return Effect.succeed(value as never);
  };

  const client = {
    library: {
      listDecks: () => Effect.succeed(decks as never),
      snoozeDecks: answer("snoozeDecks", []),
      unsnoozeDecks: answer("unsnoozeDecks", []),
    },
    me: { get: () => Effect.succeed({ settings: { timezone: "UTC" } } as never) },
  };

  const spy = spyOn(session, "call").mockImplementation(async (f) =>
    Result.succeed(await Effect.runPromise(f(client as unknown as ApiClient))),
  );

  return { requests, spy };
};

describe("DecksPage bulk snooze", () => {
  test("snoozes every selected deck for the chosen days, then reloads", async () => {
    const user = userEvent.setup();
    const { requests, spy } = fakeSession([JAPANESE, MANDARIN]);
    render(<DecksPage />);

    await user.click(await screen.findByRole("checkbox", { name: "Select Japanese N5 verbs" }));
    await user.click(screen.getByRole("checkbox", { name: "Select Mandarin HSK 1" }));

    const bar = screen.getByRole("region", { name: "Selected decks" });
    expect(bar.textContent).toContain("2 selected");

    await user.click(within(bar).getByRole("button", { name: "Snooze" }));
    await user.click(within(screen.getByRole("dialog", { name: "Snooze 2 decks" })).getByRole("button", { name: "3 days" }));

    await waitFor(() => expect(requests.map((r) => r.endpoint)).toContain("snoozeDecks"));

    const snooze = requests.find((r) => r.endpoint === "snoozeDecks");
    expect(snooze?.payload).toEqual({ deckSlugs: [JAPANESE.slug, MANDARIN.slug], days: 3 });
    expect(screen.queryByRole("region", { name: "Selected decks" })).toBeNull();

    spy.mockRestore();
  });

  test("unsnoozes the selected decks from the bar", async () => {
    const user = userEvent.setup();
    const { requests, spy } = fakeSession([JAPANESE]);
    render(<DecksPage />);

    await user.click(await screen.findByRole("checkbox", { name: "Select Japanese N5 verbs" }));
    await user.click(within(screen.getByRole("region", { name: "Selected decks" })).getByRole("button", { name: "Unsnooze" }));

    await waitFor(() => expect(requests.map((r) => r.endpoint)).toContain("unsnoozeDecks"));

    expect(requests.find((r) => r.endpoint === "unsnoozeDecks")?.payload).toEqual({ deckSlugs: [JAPANESE.slug] });

    spy.mockRestore();
  });
});
