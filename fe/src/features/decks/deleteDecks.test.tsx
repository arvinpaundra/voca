import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Effect, Result } from "effect";
import type { DeckSummary } from "@voca/contract";
import type { ApiClient } from "../../lib/api";
import { session } from "../../lib/appSession";
import { queryClient } from "../../lib/queryClient";
import { DecksPage } from "./DecksPage";

// Deleting the library selection: one confirmation naming the count, one request, and how many failed.

const deck = (slug: string, title: string, snooze: DeckSummary["snooze"] = null) =>
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

const DECKS = [
  deck("DECK000001", "Japanese N5 verbs"),
  deck("DECK000002", "Korean basics"),
  deck("DECK000003", "Spanish food"),
  deck("DECK000004", "Mandarin HSK 1", { until: null } as DeckSummary["snooze"]),
];

type Sent = { deleteDecks: unknown[]; unsnoozeDecks: unknown[] };

const fakeSession = (failed: readonly string[] = []) => {
  const sent: Sent = { deleteDecks: [], unsnoozeDecks: [] };

  const client = {
    library: {
      listDecks: () => Effect.succeed({ items: DECKS, nextCursor: null, total: DECKS.length, termLangs: [] } as never),
      deleteDecks: (request: { payload: unknown }) => {
        sent.deleteDecks.push(request.payload);
        return Effect.succeed({ failed } as never);
      },
      unsnoozeDecks: (request: { payload: unknown }) => {
        sent.unsnoozeDecks.push(request.payload);
        return Effect.succeed([] as never);
      },
    },
    me: { get: () => Effect.succeed({ settings: { timezone: "UTC" } } as never) },
  };

  const spy = spyOn(session, "call").mockImplementation(async (f) =>
    Result.succeed(await Effect.runPromise(f(client as unknown as ApiClient))),
  );

  return { spy, sent };
};

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
  queryClient.clear();
});

const bar = () => screen.getByRole("region", { name: "Selected decks" });

const selectThree = async (user: ReturnType<typeof userEvent.setup>) => {
  await screen.findByText("Japanese N5 verbs");
  await user.click(screen.getByRole("button", { name: "Select" }));
  await user.click(screen.getByRole("checkbox", { name: "Select Japanese N5 verbs" }));
  await user.click(screen.getByRole("checkbox", { name: "Select Korean basics" }));
  await user.click(screen.getByRole("checkbox", { name: "Select Spanish food" }));
};

describe("deleting the selected decks", () => {
  test("the bar offers Snooze, Unsnooze and Delete, and Delete is a danger button", async () => {
    const user = userEvent.setup();
    const api = fakeSession();
    restore = () => api.spy.mockRestore();
    render(<DecksPage />);

    await selectThree(user);

    const actions = within(bar()).getAllByRole("button").map((button) => button.textContent?.trim());
    expect(actions).toEqual(expect.arrayContaining(["Snooze", "Unsnooze", "Delete"]));
    expect(within(bar()).getByRole("button", { name: "Delete" }).classList.contains("btn-danger")).toBe(true);
  });

  test("confirming deletes the 3 decks in one request, leaves select mode and refreshes the cache", async () => {
    const user = userEvent.setup();
    const api = fakeSession();
    const invalidate = spyOn(queryClient, "invalidateQueries");
    restore = () => {
      api.spy.mockRestore();
      invalidate.mockRestore();
    };
    render(<DecksPage />);

    await selectThree(user);
    await user.click(within(bar()).getByRole("button", { name: "Delete" }));

    const dialog = screen.getByRole("dialog", { name: "Delete 3 decks?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete 3 decks" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Select" })).toBeDefined());
    expect(api.sent.deleteDecks).toEqual([{ deckSlugs: ["DECK000001", "DECK000002", "DECK000003"] }]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(invalidate).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("cancelling deletes nothing and keeps the selection", async () => {
    const user = userEvent.setup();
    const api = fakeSession();
    restore = () => api.spy.mockRestore();
    render(<DecksPage />);

    await selectThree(user);
    await user.click(within(bar()).getByRole("button", { name: "Delete" }));
    await user.click(within(screen.getByRole("dialog", { name: "Delete 3 decks?" })).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api.sent.deleteDecks).toEqual([]);
    expect(bar().textContent).toContain("3 selected");
  });

  test("says how many decks could not be deleted", async () => {
    const user = userEvent.setup();
    const api = fakeSession(["DECK000002", "DECK000003"]);
    const invalidate = spyOn(queryClient, "invalidateQueries");
    restore = () => {
      api.spy.mockRestore();
      invalidate.mockRestore();
    };
    render(<DecksPage />);

    await selectThree(user);
    await user.click(within(bar()).getByRole("button", { name: "Delete" }));
    await user.click(within(screen.getByRole("dialog", { name: "Delete 3 decks?" })).getByRole("button", { name: "Delete 3 decks" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("2 decks could not be deleted.");
    expect(invalidate).toHaveBeenCalled();
  });

  test("one failed deck is named in the singular", async () => {
    const user = userEvent.setup();
    const api = fakeSession(["DECK000002"]);
    restore = () => api.spy.mockRestore();
    render(<DecksPage />);

    await selectThree(user);
    await user.click(within(bar()).getByRole("button", { name: "Delete" }));
    await user.click(within(screen.getByRole("dialog", { name: "Delete 3 decks?" })).getByRole("button", { name: "Delete 3 decks" }));

    expect((await screen.findByRole("alert")).textContent).toContain("1 deck could not be deleted.");
  });

  test("Unsnooze sends exactly the selected decks", async () => {
    const user = userEvent.setup();
    const api = fakeSession();
    restore = () => api.spy.mockRestore();
    render(<DecksPage />);

    await screen.findByText("Japanese N5 verbs");
    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(screen.getByRole("checkbox", { name: "Select Japanese N5 verbs" }));
    await user.click(screen.getByRole("checkbox", { name: "Select Mandarin HSK 1" }));
    await user.click(within(bar()).getByRole("button", { name: "Unsnooze" }));

    await waitFor(() => expect(api.sent.unsnoozeDecks).toEqual([{ deckSlugs: ["DECK000001", "DECK000004"] }]));
  });
});
