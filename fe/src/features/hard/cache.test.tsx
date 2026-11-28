import { afterEach, describe, expect, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DeckDetail, DeckSlug, HardWord } from "@voca/contract";
import { activeSessionQuery, deckQuery, deckSetupQuery, hardWordsQuery, meQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { cacheSession } from "../../test/cacheSession";
import { StudySetupPage } from "../study/SetupPage";
import { StudyPage } from "../study/StudyPage";
import { HardWordsPage } from "./HardWordsPage";

// The study setup and Hard Words pages read through the shared query cache: cached data renders at once, with no
// request, and a write refreshes what it changed. A live study session is the exception: it is always fetched.

const DECK = "DECK000001" as DeckSlug;

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
  wordCount: 0,
  dueCount: 0,
} as unknown as DeckDetail;

const me = { name: "Arvin Paundra", settings: { timezone: "UTC", dayStartHour: 4, defaultSessionSize: 10 } };

const hard = {
  slug: "WRD000000001",
  term: "食べる",
  reading: null,
  meaning: "to eat",
  example: null,
  notes: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  cards: [{ drill: "term_meaning", due: "2026-11-18T00:00:00.000Z", stabilityDays: 4, isHard: true }],
  deck: { slug: DECK, title: "Japanese N5 verbs", termLang: "ja", meaningLang: "en" },
} as unknown as HardWord;

const hardPage = { pages: [{ items: [hard], nextCursor: null }], pageParams: [undefined] };

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
});

describe("cached pages", () => {
  test("the study setup renders the cached deck and drills without a request", async () => {
    queryClient.setQueryData(deckQuery(DECK).queryKey, deck);
    queryClient.setQueryData(meQuery().queryKey, me as never);
    queryClient.setQueryData(deckSetupQuery(DECK).queryKey, { drills: [], newCards: { studied: 0, target: 20 } });
    const api = cacheSession("NF");
    restore = api.restore;

    render(<StudySetupPage deckSlug={DECK} />);
    await api.expectNoReads("StudySetupPage");

    expect(screen.getByText("This deck has no words to study yet.")).toBeTruthy();
  });

  test("Hard Words renders the cached words without a request", async () => {
    queryClient.setQueryData(hardWordsQuery().queryKey, hardPage as never);
    queryClient.setQueryData(meQuery().queryKey, me as never);
    const api = cacheSession("QS");
    restore = api.restore;

    render(<HardWordsPage />);
    await api.expectNoReads("HardWordsPage");

    expect(screen.getByRole("button", { name: "Unmark 食べる as hard" })).toBeTruthy();
  });
});

describe("writes", () => {
  test("unmarking a hard word refreshes the cached list", async () => {
    queryClient.setQueryData(hardWordsQuery().queryKey, hardPage as never);
    queryClient.setQueryData(meQuery().queryKey, me as never);
    const user = userEvent.setup();
    const api = cacheSession("QS", {
      "study.unmarkHard": () => undefined,
      "study.hardWords": () => ({ items: [], nextCursor: null }),
      "me.get": () => me,
    });
    restore = api.restore;

    render(<HardWordsPage />);
    await api.expectNoReads("HardWordsPage");

    await user.click(screen.getByRole("button", { name: "Unmark 食べる as hard" }));

    await waitFor(() => expect(api.calls).toContain("study.hardWords"));
    expect(api.calls[0]).toBe("study.unmarkHard");
  });
});

describe("the live session", () => {
  test("the study page fetches the live session through its query, every time it opens", async () => {
    const api = cacheSession("QS", { "study.active": () => null });
    restore = api.restore;

    const first = render(<StudyPage />);
    await screen.findByText("No study session is running.");

    if (queryClient.getQueryCache().find({ queryKey: activeSessionQuery().queryKey }) === undefined) {
      throw new Error("not implemented: QS: StudyPage does not read the live session through activeSessionQuery");
    }

    first.unmount();
    render(<StudyPage />);
    await screen.findByText("No study session is running.");

    await waitFor(() => expect(api.calls.filter((endpoint) => endpoint === "study.active")).toHaveLength(2));
  });
});
