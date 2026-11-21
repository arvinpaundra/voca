import { describe, expect, spyOn, test } from "bun:test";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Effect } from "effect";
import { DuplicateWords } from "@voca/contract";
import type { DeckDetail, Word, WordWithCards } from "@voca/contract";
import type { ApiClient } from "../../lib/api";
import { session } from "../../lib/appSession";
import { DeckView } from "./DeckView";

// A word's header in the Add word modal toggles it: the open word folds, a folded word opens, and every word can be
// folded at once.

const DECK = "DECK000002";

const deck = {
  slug: DECK,
  title: "Japanese animals",
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

const FISH = {
  slug: "WRD000000009",
  term: "魚",
  reading: null,
  meaning: "fish",
  example: null,
  notes: null,
  createdAt: "2026-11-01T00:00:00.000Z",
} as unknown as Word;

type Payload = { term: string; meaning: string; reading?: string };

// A fake API client for the deck page. `createWords` saves into the fake's own list, or answers `duplicates`.
const fakeSession = (duplicates: ReadonlyArray<number> | null = null) => {
  const requests: { endpoint: string; request: any }[] = [];
  let words: WordWithCards[] = [{ ...FISH, cards: [] } as unknown as WordWithCards];

  const record = (endpoint: string, answer: (request: any) => Effect.Effect<unknown, unknown>) => (request: any) => {
    requests.push({ endpoint, request });

    return answer(request);
  };

  const client = {
    library: {
      listWords: record("listWords", () => Effect.succeed({ items: words, nextCursor: null })),
      createWords: record("createWords", (request) => {
        if (duplicates !== null) {
          return Effect.fail(new DuplicateWords({ message: "duplicates", indexes: duplicates }));
        }

        const saved = (request.payload.words as Payload[]).map((payload, i) => ({
          ...FISH,
          slug: `WRDNEW00000${i}`,
          reading: null,
          ...payload,
        }));
        words = [...words, ...saved.map((word) => ({ ...word, cards: [] }) as unknown as WordWithCards)];

        return Effect.succeed(saved);
      }),
    },
    insight: {
      deckStats: record("deckStats", () =>
        Effect.succeed({
          maturity: { new: 1, learning: 0, mature: 0 },
          dueToday: 0,
          overdue: 0,
          forecast: [],
          trueRetention: null,
          calibration: null,
          reviewsPerDay: [],
        }),
      ),
    },
    me: { get: record("me", () => Effect.succeed({ settings: { timezone: "UTC" } })) },
  };

  const spy = spyOn(session, "call").mockImplementation((f) =>
    Effect.runPromise(Effect.result(f(client as unknown as ApiClient) as Effect.Effect<unknown, unknown>)) as never,
  );

  const created = () => requests.filter((entry) => entry.endpoint === "createWords");

  return { created, spy };
};

const openAddModal = async () => {
  render(<DeckView deck={deck} />);
  await screen.findByRole("button", { name: "Open 魚" });

  fireEvent.click(screen.getAllByRole("button", { name: "Add word" })[0]!);

  return screen.findByRole("dialog", { name: "Add words" });
};

// Fills the open word's fields. The ja deck labels its term "Word".
const fill = async (user: ReturnType<typeof userEvent.setup>, modal: HTMLElement, term: string, meaning: string) => {
  if (term !== "") await user.type(within(modal).getByLabelText("Word"), term);
  if (meaning !== "") await user.type(within(modal).getByLabelText("Meaning"), meaning);
};

const addThree = async (
  user: ReturnType<typeof userEvent.setup>,
  modal: HTMLElement,
  words: ReadonlyArray<readonly [string, string]>,
) => {
  for (const [i, [term, meaning]] of words.entries()) {
    if (i > 0) await user.click(within(modal).getByRole("button", { name: "Add another" }));

    await fill(user, modal, term, meaning);
  }
};

describe("Add word modal headers", () => {
  test("clicking the open word's header folds it, leaving no word open", async () => {
    const user = userEvent.setup();
    const { spy } = fakeSession();
    const modal = await openAddModal();

    await fill(user, modal, "犬", "dog");
    await user.click(within(modal).getByRole("button", { name: "Word 1" }));

    const folded = await within(modal).findByRole("button", { name: /犬 · dog/ });
    expect(folded.getAttribute("aria-expanded")).toBe("false");
    expect(within(modal).queryAllByLabelText("Meaning")).toHaveLength(0);

    spy.mockRestore();
  });

  test("clicking a folded word's header opens it with what was typed", async () => {
    const user = userEvent.setup();
    const { spy } = fakeSession();
    const modal = await openAddModal();

    await addThree(user, modal, [["犬", "dog"], ["猫", "cat"]]);
    await user.click(within(modal).getByRole("button", { name: "Word 2" }));
    await within(modal).findByRole("button", { name: /猫 · cat/ });

    expect(within(modal).queryAllByLabelText("Meaning")).toHaveLength(0);

    await user.click(within(modal).getByRole("button", { name: /犬 · dog/ }));

    expect(within(modal).getByRole("button", { name: "Word 1" }).getAttribute("aria-expanded")).toBe("true");
    expect(within(modal).getAllByLabelText("Meaning")).toHaveLength(1);
    expect((within(modal).getByLabelText("Meaning") as HTMLInputElement).value).toBe("dog");

    spy.mockRestore();
  });

  test("every word folded still saves them all", async () => {
    const user = userEvent.setup();
    const { created, spy } = fakeSession();
    const modal = await openAddModal();

    await addThree(user, modal, [["犬", "dog"], ["猫", "cat"]]);
    await user.click(within(modal).getByRole("button", { name: "Word 2" }));
    await within(modal).findByRole("button", { name: /猫 · cat/ });
    await user.click(within(modal).getByRole("button", { name: "Add 2 words" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add words" })).toBeNull());
    expect(created()[0]!.request.payload.words.map((word: Payload) => word.term)).toEqual(["犬", "猫"]);

    spy.mockRestore();
  });
});
