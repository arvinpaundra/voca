import { describe, expect, spyOn, test } from "bun:test";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Effect } from "effect";
import { DuplicateWords } from "@voca/contract";
import type { DeckDetail, Word, WordWithCards } from "@voca/contract";
import type { ApiClient } from "../../lib/api";
import { session } from "../../lib/appSession";
import { DeckView } from "./DeckView";

// The Add word modal holds a list of new words, saved together in one request or not at all. Only the word being
// edited shows its fields; the others fold to "term · meaning".

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

describe("Add word modal with several words", () => {
  test("Add another folds the previous word to term · meaning and opens a new one", async () => {
    const user = userEvent.setup();
    const { spy } = fakeSession();
    const modal = await openAddModal();

    await fill(user, modal, "犬", "dog");
    await user.click(within(modal).getByRole("button", { name: "Add another" }));

    expect(within(modal).getByText(/犬 · dog/)).toBeTruthy();
    expect(within(modal).getAllByLabelText("Meaning").length).toBe(1);
    expect((within(modal).getByLabelText("Meaning") as HTMLInputElement).value).toBe("");

    await user.click(within(modal).getByText(/犬 · dog/));

    expect((within(modal).getByLabelText("Meaning") as HTMLInputElement).value).toBe("dog");
    expect(within(modal).getAllByLabelText("Meaning").length).toBe(1);

    spy.mockRestore();
  });

  test("three valid words save in one request and show as three new rows", async () => {
    const user = userEvent.setup();
    const { created, spy } = fakeSession();
    const modal = await openAddModal();

    await addThree(user, modal, [["犬", "dog"], ["猫", "cat"], ["鳥", "bird"]]);
    await user.click(within(modal).getByRole("button", { name: "Add 3 words" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add words" })).toBeNull());
    expect(created().length).toBe(1);
    expect(created()[0]!.request.payload.words.map((word: Payload) => word.term)).toEqual(["犬", "猫", "鳥"]);
    expect(await screen.findByRole("button", { name: "Open 犬" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open 猫" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open 鳥" })).toBeTruthy();

    spy.mockRestore();
  });

  test("a removed word is not saved", async () => {
    const user = userEvent.setup();
    const { created, spy } = fakeSession();
    const modal = await openAddModal();

    await addThree(user, modal, [["犬", "dog"], ["猫", "cat"], ["鳥", "bird"]]);
    await user.click(within(modal).getByRole("button", { name: "Remove word 2" }));
    await user.click(within(modal).getByRole("button", { name: "Add 2 words" }));

    await waitFor(() => expect(created().length).toBe(1));
    expect(created()[0]!.request.payload.words.map((word: Payload) => word.term)).toEqual(["犬", "鳥"]);

    spy.mockRestore();
  });

  test("an invalid word saves nothing and opens with its error", async () => {
    const user = userEvent.setup();
    const { created, spy } = fakeSession();
    const modal = await openAddModal();

    await addThree(user, modal, [["犬", "dog"], ["猫", ""], ["鳥", "bird"]]);
    await user.click(within(modal).getByRole("button", { name: "Add 3 words" }));

    expect((within(modal).getByLabelText("Word") as HTMLInputElement).value).toBe("猫");
    expect(within(modal).getAllByLabelText("Meaning").length).toBe(1);
    expect(within(modal).getByText(/required/i)).toBeTruthy();
    expect(created().length).toBe(0);
    expect(screen.getByRole("dialog", { name: "Add words" })).toBeTruthy();

    spy.mockRestore();
  });

  test("words the server names as duplicates are all flagged, the first opened, and the modal stays", async () => {
    const user = userEvent.setup();
    const { created, spy } = fakeSession([0, 2]);
    const modal = await openAddModal();

    await addThree(user, modal, [["生", "raw"], ["犬", "dog"], ["生", "fresh"]]);
    await user.click(within(modal).getByRole("button", { name: "Add 3 words" }));

    await waitFor(() => expect(within(modal).getAllByText(/duplicate/i).length).toBe(2));
    expect((within(modal).getByLabelText("Meaning") as HTMLInputElement).value).toBe("raw");
    expect(created().length).toBe(1);
    expect(screen.queryByRole("button", { name: "Open 犬" })).toBeNull();

    spy.mockRestore();
  });

  test("with 50 words, Add another is disabled", async () => {
    const { spy } = fakeSession();
    const modal = await openAddModal();
    const another = () => within(modal).getByRole("button", { name: "Add another" }) as HTMLButtonElement;

    for (let i = 1; i < 49; i++) fireEvent.click(another());
    expect(another().disabled).toBe(false);

    fireEvent.click(another());
    expect(another().disabled).toBe(true);

    spy.mockRestore();
  });
});
