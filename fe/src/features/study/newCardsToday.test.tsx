import { afterEach, describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import type { DeckDetail, DeckSetup, DeckSlug } from "@voca/contract";
import { deckQuery, deckSetupQuery, meQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { cacheSession } from "../../test/cacheSession";
import { StudySetupPage } from "./SetupPage";

const DECK = "DECK000036" as DeckSlug;

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
  wordCount: 200,
  dueCount: 20,
} as unknown as DeckDetail;

const me = {
  name: "Arvin Paundra",
  settings: { timezone: "UTC", dayStartHour: 4, newPerDay: 30, defaultSessionSize: 10, defaultMode: "easy" },
};

const setupOf = (studied: number, target: number) =>
  ({
    drills: [
      { drill: "term_meaning", label: "Word → Meaning", due: 14, new: 186 },
      { drill: "meaning_term", label: "Meaning → Word", due: 6, new: 192 },
      { drill: "term_reading", label: "Word → Kana", due: 0, new: 200 },
      { drill: "reading_term", label: "Kana → Word", due: 0, new: 200 },
    ],
    newCards: { studied, target },
  }) as unknown as DeckSetup;

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
  queryClient.clear();
});

const renderSetup = async (studied: number, target: number) => {
  queryClient.setQueryData(deckQuery(DECK).queryKey, deck);
  queryClient.setQueryData(meQuery().queryKey, me as never);
  queryClient.setQueryData(deckSetupQuery(DECK).queryKey, setupOf(studied, target));
  const api = cacheSession("NF");
  restore = api.restore;

  render(<StudySetupPage deckSlug={DECK} />);
  await api.expectNoReads("StudySetupPage");
};

const targetLine = () => {
  const line = document.querySelector(".target");

  if (line === null) throw new Error("not implemented: NF: no .target line on the study setup");

  return line;
};

describe("study setup: new cards today", () => {
  test("below the target: the count against the target, under the drill choices", async () => {
    await renderSetup(12, 30);

    const line = targetLine();

    expect(line.textContent).toBe("New cards today: 12 of 30");
    expect(line.querySelector("b")?.textContent).toBe("12 of 30");

    const choices = document.querySelector(".choices")!;
    const sizeLabel = screen.getByText("Session size");

    expect(choices.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(line.compareDocumentPosition(sizeLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("at the target: target reached", async () => {
    await renderSetup(30, 30);

    expect(targetLine().textContent).toBe("New cards today: 30 of 30 · target reached");
    expect(targetLine().querySelector(".done")?.textContent).toBe("target reached");
  });

  test("past the target: the count goes on, still target reached", async () => {
    await renderSetup(50, 30);

    expect(targetLine().textContent).toBe("New cards today: 50 of 30 · target reached");
  });

  test("each drill shows its due and new cards from the setup, and Start stays enabled past the target", async () => {
    await renderSetup(34, 30);

    expect(screen.getByText("14 due · 186 new")).toBeTruthy();
    expect(screen.getByText("6 due · 192 new")).toBeTruthy();
    expect(screen.getAllByText("0 due · 200 new")).toHaveLength(2);
    expect((screen.getByRole("button", { name: "Start session" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
