import { describe, expect, spyOn, test } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Effect, Result } from "effect";
import type { DeckDetail, Word, WordWithCards } from "@voca/contract";
import type { ApiClient } from "../../lib/api";
import { session } from "../../lib/appSession";
import { PreviewList } from "../discover/PreviewList";
import { wordHref } from "../word/wordHref";
import { DeckView } from "./DeckView";

// A word opens in a modal over the list it was clicked in, from anywhere on its row. The modal is view only: on the
// Learner's own deck it also shows the word's metrics and Full details; in a Community preview it shows the content only.

const DECK = "DECK000001";

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
  wordCount: 2,
  dueCount: 0,
} as unknown as DeckDetail;

const word = (slug: string, term: string, reading: string | null, meaning: string, example: string | null, notes: string | null) =>
  ({ slug, term, reading, meaning, example, notes, createdAt: "2026-11-01T00:00:00.000Z" }) as unknown as Word;

const EAT = word("WRD000000001", "食べる", "たべる", "to eat", "朝ごはんを食べる", "ichidan verb");
const DRINK = word("WRD000000002", "飲む", "のむ", "to drink", null, null);

const listed = (entry: Word) => ({ ...entry, cards: [] }) as unknown as WordWithCards;

const drillStats = {
  drill: "term_meaning",
  label: "Term → meaning",
  maturity: "learning",
  recallNow: 0.82,
  stabilityDays: 4.2,
  difficulty: 5.1,
  reps: 6,
  lapses: 1,
  leech: false,
  isHard: false,
  accuracy: { overall: 0.83, last10: 0.8, easy: 0.9, hard: null },
  streak: 3,
  medianLatencyMs: 2400,
  attemptsToCorrect: 1.2,
  nextDue: "2026-11-25T04:00:00.000Z",
  intervalDays: 4,
  firstSeen: "2026-11-01T04:00:00.000Z",
  lastReviewed: "2026-11-21T04:00:00.000Z",
  confusedWith: [],
  history: [],
};

const deckStats = {
  maturity: { new: 1, learning: 1, mature: 0 },
  dueToday: 0,
  overdue: 0,
  forecast: [],
  trueRetention: null,
  calibration: null,
  reviewsPerDay: [],
};

// A fake API client for the deck page; every call is recorded by endpoint name.
const fakeSession = () => {
  const requests: { endpoint: string; request: unknown }[] = [];

  const record = <A,>(endpoint: string, answer: (request: any) => A) => (request: any) => {
    requests.push({ endpoint, request });

    return Effect.succeed(answer(request) as never);
  };

  // The list is the fake's own, so the refetch after a write reads back what the write saved.
  let words = [listed(EAT), listed(DRINK)];

  const client = {
    library: {
      listWords: record("listWords", () => ({ items: words, nextCursor: null })),
      updateWord: record("updateWord", (request) => {
        const saved = { ...EAT, ...request.payload };
        words = words.map((entry) => (entry.slug === EAT.slug ? { ...entry, ...saved } : entry));

        return saved;
      }),
      deleteWord: record("deleteWord", (request) => {
        words = words.filter((entry) => entry.slug !== request.params.wordSlug);
      }),
    },
    insight: {
      deckStats: record("deckStats", () => deckStats),
      wordStats: record("wordStats", (request) => ({
        word: request.params.wordSlug === EAT.slug ? EAT : DRINK,
        drills: [drillStats],
      })),
    },
    me: { get: record("me", () => ({ settings: { timezone: "UTC" } })) },
  };

  const spy = spyOn(session, "call").mockImplementation(async (f) =>
    Result.succeed(await Effect.runPromise(f(client as unknown as ApiClient))),
  );

  return { requests, spy };
};

const renderDeck = async () => {
  render(<DeckView deck={deck} />);

  await screen.findByRole("button", { name: "Open 食べる" });
};

const wordList = () => screen.getByRole("list", { name: "Words" });

describe("WordDetailsModal on the deck page", () => {
  test("a click on a word opens its modal with every field, and the URL stays on the deck page", async () => {
    const user = userEvent.setup();
    const { spy } = fakeSession();
    const before = window.location.href;
    await renderDeck();

    await user.click(screen.getByRole("button", { name: "Open 食べる" }));

    const modal = await screen.findByRole("dialog", { name: "食べる" });
    expect(modal.textContent).toContain("たべる");
    expect(modal.textContent).toContain("to eat");
    expect(modal.textContent).toContain("朝ごはんを食べる");
    expect(modal.textContent).toContain("ichidan verb");
    expect(within(modal).getByText("Example")).toBeTruthy();
    expect(within(modal).getByText("Notes")).toBeTruthy();
    expect(window.location.href).toBe(before);

    spy.mockRestore();
  });

  test("an empty example or notes is left out, not shown blank", async () => {
    const user = userEvent.setup();
    const { spy } = fakeSession();
    await renderDeck();

    await user.click(screen.getByRole("button", { name: "Open 飲む" }));

    const modal = await screen.findByRole("dialog", { name: "飲む" });
    expect(modal.textContent).toContain("to drink");
    expect(within(modal).queryByText("Example")).toBeNull();
    expect(within(modal).queryByText("Notes")).toBeNull();

    spy.mockRestore();
  });

  test("every direction starts folded, showing its label and recall now only", async () => {
    const user = userEvent.setup();
    const { requests, spy } = fakeSession();
    await renderDeck();

    await user.click(screen.getByRole("button", { name: "Open 食べる" }));

    const modal = await screen.findByRole("dialog", { name: "食べる" });
    const direction = await within(modal).findByRole("button", { name: /Term → meaning.*82%/ });

    expect(direction.getAttribute("aria-expanded")).toBe("false");
    expect(modal.textContent).not.toContain("stability");
    expect(modal.textContent).not.toContain("lapses");
    expect(modal.textContent).not.toContain("reviews");
    expect(modal.textContent).not.toContain("accuracy");

    const statsCalls = requests.filter((entry) => entry.endpoint === "wordStats");
    expect(statsCalls.map((entry) => (entry.request as { params: { wordSlug: string } }).params.wordSlug)).toEqual([EAT.slug]);

    spy.mockRestore();
  });

  test("unfolding a direction shows its five metrics, and folding hides them again", async () => {
    const user = userEvent.setup();
    const { spy } = fakeSession();
    await renderDeck();

    await user.click(screen.getByRole("button", { name: "Open 食べる" }));

    const modal = await screen.findByRole("dialog", { name: "食べる" });
    const direction = await within(modal).findByRole("button", { name: /Term → meaning.*82%/ });

    await user.click(direction);

    expect(direction.getAttribute("aria-expanded")).toBe("true");
    for (const label of ["recall now", "stability", "lapses", "reviews", "accuracy"]) {
      expect(modal.textContent).toContain(label);
    }
    expect(modal.textContent).toContain("4.2");
    expect(modal.textContent).toContain("83%");

    await user.click(direction);

    expect(direction.getAttribute("aria-expanded")).toBe("false");
    expect(modal.textContent).not.toContain("stability");
    expect(modal.textContent).not.toContain("lapses");

    spy.mockRestore();
  });

  test("Full details links to the word page", async () => {
    const user = userEvent.setup();
    const { spy } = fakeSession();
    await renderDeck();

    await user.click(screen.getByRole("button", { name: "Open 食べる" }));

    const modal = await screen.findByRole("dialog", { name: "食べる" });
    expect(within(modal).getByRole("link", { name: "Full details" }).getAttribute("href")).toBe(wordHref(DECK, EAT.slug));

    spy.mockRestore();
  });

  test("a click on a row's meaning opens the word's modal", async () => {
    const user = userEvent.setup();
    const { spy } = fakeSession();
    await renderDeck();

    await user.click(within(wordList()).getByText("to eat"));

    const modal = await screen.findByRole("dialog", { name: "食べる" });
    expect(modal.textContent).toContain("ichidan verb");

    spy.mockRestore();
  });

  test("the row's edit button opens the editor, not the modal", async () => {
    const user = userEvent.setup();
    const { spy } = fakeSession();
    await renderDeck();

    await user.click(within(wordList()).getByRole("button", { name: "Edit 食べる" }));

    await screen.findByRole("dialog", { name: "Edit word" });
    expect(screen.queryByRole("dialog", { name: "食べる" })).toBeNull();

    spy.mockRestore();
  });

  test("the row's delete button opens the delete confirmation, not the modal", async () => {
    const user = userEvent.setup();
    const { spy } = fakeSession();
    await renderDeck();

    await user.click(within(wordList()).getByRole("button", { name: "Delete 食べる" }));

    await screen.findByRole("dialog", { name: "Delete word?" });
    expect(screen.queryByRole("dialog", { name: "食べる" })).toBeNull();

    spy.mockRestore();
  });

  test("the modal is view only: no Edit word or Delete word", async () => {
    const user = userEvent.setup();
    const { spy } = fakeSession();
    await renderDeck();

    await user.click(screen.getByRole("button", { name: "Open 食べる" }));

    const modal = await screen.findByRole("dialog", { name: "食べる" });
    expect(modal.textContent).not.toContain("Edit word");
    expect(modal.textContent).not.toContain("Delete word");
    expect(within(modal).getByRole("link", { name: "Full details" })).toBeTruthy();

    spy.mockRestore();
  });

  test("Esc closes the modal and leaves the deck page as it was", async () => {
    const user = userEvent.setup();
    const { spy } = fakeSession();
    const before = window.location.href;
    await renderDeck();

    await user.click(screen.getByRole("button", { name: "Open 食べる" }));
    await screen.findByRole("dialog", { name: "食べる" });
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "食べる" })).toBeNull());
    expect(window.location.href).toBe(before);
    expect(within(wordList()).getByRole("button", { name: "Open 食べる" })).toBeTruthy();

    spy.mockRestore();
  });
});

describe("WordDetailsModal in a Community preview", () => {
  test("a click on a word shows its content only, and calls no API", async () => {
    const user = userEvent.setup();
    const spy = spyOn(session, "call").mockImplementation(() => Promise.reject(new Error("a preview calls no API")));
    render(<PreviewList words={[EAT, DRINK]} total={2} termLang="ja" meaningLang="en" />);

    await user.click(screen.getByRole("button", { name: "Open 食べる" }));

    const modal = await screen.findByRole("dialog", { name: "食べる" });
    expect(modal.textContent).toContain("たべる");
    expect(modal.textContent).toContain("to eat");
    expect(modal.textContent).toContain("ichidan verb");
    expect(modal.textContent).not.toContain("recall now");
    expect(within(modal).queryByRole("button", { name: "Edit word" })).toBeNull();
    expect(within(modal).queryByRole("button", { name: "Delete word" })).toBeNull();
    expect(within(modal).queryByRole("link", { name: "Full details" })).toBeNull();
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  test("a click on a row's meaning opens the word's modal", async () => {
    const user = userEvent.setup();
    const spy = spyOn(session, "call").mockImplementation(() => Promise.reject(new Error("a preview calls no API")));
    render(<PreviewList words={[EAT, DRINK]} total={2} termLang="ja" meaningLang="en" />);

    await user.click(screen.getByText("to eat"));

    const modal = await screen.findByRole("dialog", { name: "食べる" });
    expect(modal.textContent).toContain("ichidan verb");

    spy.mockRestore();
  });
});
