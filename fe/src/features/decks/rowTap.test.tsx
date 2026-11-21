import { describe, expect, mock, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DeckSummary } from "@voca/contract";
import { DeckRows } from "./DeckRows";

// In select mode a deck row is one tap target that ticks it: no link, no Study button, no ⋯ menu.
// Outside select mode the row keeps its link to the deck page, its Study button and its menu.

const deck = (slug: string, title: string) =>
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
    snooze: null,
    wordCount: 12,
    dueCount: 3,
  }) as unknown as DeckSummary;

const JAPANESE = deck("DECK000001", "Japanese N5 verbs");
const MANDARIN = deck("DECK000004", "Mandarin HSK 1");

const renderSelecting = () => {
  const onToggleSelect = mock((_deck: DeckSummary) => {});
  render(
    <DeckRows
      decks={[JAPANESE, MANDARIN]}
      onEdit={() => {}}
      onDelete={() => {}}
      selected={new Set<string>()}
      onToggleSelect={onToggleSelect}
    />,
  );

  return onToggleSelect;
};

// The list item that holds a deck's checkbox.
const rowOf = (title: string) => {
  const row = screen.getByRole("checkbox", { name: `Select ${title}` }).closest("li");
  if (row === null) throw new Error(`no row for ${title}`);

  return row;
};

describe("DeckRows in select mode", () => {
  test("a tap on the title or the counts ticks only that row", async () => {
    const user = userEvent.setup();
    const onToggleSelect = renderSelecting();
    const row = rowOf("Japanese N5 verbs");

    await user.click(within(row).getByText("Japanese N5 verbs"));
    await user.click(within(row).getByText("words"));

    expect(onToggleSelect).toHaveBeenCalledTimes(2);
    expect(onToggleSelect.mock.calls.every(([picked]) => picked.slug === JAPANESE.slug)).toBe(true);
  });

  test("a tap on the checkbox ticks the row once", async () => {
    const user = userEvent.setup();
    const onToggleSelect = renderSelecting();
    rowOf("Japanese N5 verbs");

    await user.click(screen.getByRole("checkbox", { name: "Select Japanese N5 verbs" }));

    expect(onToggleSelect).toHaveBeenCalledTimes(1);
  });

  test("a row has no link, no Study button and no actions menu", () => {
    renderSelecting();
    const row = rowOf("Japanese N5 verbs");

    expect(within(row).queryAllByRole("link")).toHaveLength(0);
    expect(within(row).queryByRole("button", { name: "Actions for Japanese N5 verbs" })).toBeNull();
  });
});

describe("DeckRows outside select mode", () => {
  test("a row links to its deck page and keeps Study and its menu", () => {
    render(<DeckRows decks={[JAPANESE]} onEdit={() => {}} onDelete={() => {}} />);

    expect(screen.getByRole("link", { name: "Japanese N5 verbs" }).getAttribute("href")).toBe("/app/decks/DECK000001");
    expect(screen.getByRole("link", { name: "Study Japanese N5 verbs" }).getAttribute("href")).toBe("/app/decks/DECK000001/study");
    expect(screen.getByRole("button", { name: "Actions for Japanese N5 verbs" })).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
