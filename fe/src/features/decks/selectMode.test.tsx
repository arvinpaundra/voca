import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Effect, Result } from "effect";
import type { ApiClient } from "../../lib/api";
import { session } from "../../lib/appSession";
import type { DeckSummary } from "@voca/contract";
import { DecksPage } from "./DecksPage";

// Select mode on the deck page: checkboxes only after "Select", and leaving the mode drops the ticks.

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
const MANDARIN = deck("DECK000004", "Mandarin HSK 1", { until: null } as DeckSummary["snooze"]);

const fakeSession = (decks: readonly DeckSummary[]) => {
  const client = {
    library: {
      listDecks: () => Effect.succeed({ items: decks, nextCursor: null, total: decks.length, termLangs: [] } as never),
      snoozeDecks: () => Effect.succeed([] as never),
      unsnoozeDecks: () => Effect.succeed([] as never),
    },
    me: { get: () => Effect.succeed({ settings: { timezone: "UTC" } } as never) },
  };

  return spyOn(session, "call").mockImplementation(async (f) =>
    Result.succeed(await Effect.runPromise(f(client as unknown as ApiClient))),
  );
};

let spy: ReturnType<typeof fakeSession> | null = null;

afterEach(() => {
  spy?.mockRestore();
  spy = null;
});

const bar = () => screen.queryByRole("region", { name: "Selected decks" });

const startSelecting = async (user: ReturnType<typeof userEvent.setup>) => {
  await screen.findByText("Japanese N5 verbs");
  await user.click(screen.getByRole("button", { name: "Select" }));
};

describe("DecksPage select mode", () => {
  test("starts with no checkboxes and no selection bar", async () => {
    spy = fakeSession([JAPANESE, MANDARIN]);
    render(<DecksPage />);

    await screen.findByText("Japanese N5 verbs");

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(bar()).toBeNull();
    expect(screen.getByRole("button", { name: "Select" })).toBeDefined();
  });

  test("Select shows the checkboxes and turns into Done", async () => {
    const user = userEvent.setup();
    spy = fakeSession([JAPANESE, MANDARIN]);
    render(<DecksPage />);

    await startSelecting(user);

    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Done" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Select" })).toBeNull();
  });

  test("snooze badges show in both modes", async () => {
    const user = userEvent.setup();
    spy = fakeSession([JAPANESE, MANDARIN]);
    render(<DecksPage />);

    // The badge may carry its label twice (shown and for screen readers), so count matches instead of expecting one.
    expect((await screen.findAllByText("Snoozed")).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Select" }));

    expect(screen.getAllByText("Snoozed").length).toBeGreaterThan(0);
  });

  test("the bar shows only once a deck is ticked", async () => {
    const user = userEvent.setup();
    spy = fakeSession([JAPANESE, MANDARIN]);
    render(<DecksPage />);

    await startSelecting(user);
    expect(bar()).toBeNull();

    await user.click(screen.getByRole("checkbox", { name: "Select Japanese N5 verbs" }));
    expect(bar()?.textContent).toContain("1 selected");
  });

  test("Done hides the checkboxes and clears the selection", async () => {
    const user = userEvent.setup();
    spy = fakeSession([JAPANESE, MANDARIN]);
    render(<DecksPage />);

    await startSelecting(user);
    await user.click(screen.getByRole("checkbox", { name: "Select Japanese N5 verbs" }));
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(bar()).toBeNull();

    await user.click(screen.getByRole("button", { name: "Select" }));

    const box = screen.getByRole("checkbox", { name: "Select Japanese N5 verbs" }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(bar()).toBeNull();
  });

  test("Escape leaves select mode and clears the selection", async () => {
    const user = userEvent.setup();
    spy = fakeSession([JAPANESE, MANDARIN]);
    render(<DecksPage />);

    await startSelecting(user);
    await user.click(screen.getByRole("checkbox", { name: "Select Japanese N5 verbs" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(bar()).toBeNull();
    expect(screen.getByRole("button", { name: "Select" })).toBeDefined();
  });

  test("a successful snooze leaves select mode", async () => {
    const user = userEvent.setup();
    spy = fakeSession([JAPANESE, MANDARIN]);
    render(<DecksPage />);

    await startSelecting(user);
    await user.click(screen.getByRole("checkbox", { name: "Select Japanese N5 verbs" }));
    await user.click(within(bar() as HTMLElement).getByRole("button", { name: "Snooze" }));
    await user.click(within(screen.getByRole("dialog", { name: "Snooze deck" })).getByRole("button", { name: "3 days" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Select" })).toBeDefined());
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(bar()).toBeNull();
  });

  test("a successful unsnooze leaves select mode", async () => {
    const user = userEvent.setup();
    spy = fakeSession([JAPANESE, MANDARIN]);
    render(<DecksPage />);

    await startSelecting(user);
    await user.click(screen.getByRole("checkbox", { name: "Select Mandarin HSK 1" }));
    await user.click(within(bar() as HTMLElement).getByRole("button", { name: "Unsnooze" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Select" })).toBeDefined());
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(bar()).toBeNull();
  });
});
