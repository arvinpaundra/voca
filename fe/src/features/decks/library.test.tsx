import { describe, expect, mock, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Deck, DeckStats, DeckSummary, WordWithCards } from "@voca/contract";
import { DeckProgress } from "../deck/DeckProgress";
import { WordTable } from "../deck/WordTable";
import { DeckTable } from "./DeckTable";

const deck = (slug: string, title: string, wordCount: number, dueCount: number, visibility = "private") =>
  ({
    slug,
    title,
    description: "",
    termLang: "ja",
    meaningLang: "en",
    visibility,
    publishedAt: null,
    forkedFrom: null,
    forkCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    wordCount,
    dueCount,
  }) as unknown as DeckSummary;

const word = (slug: string, term: string, reading: string | null, meaning: string) =>
  ({
    slug,
    term,
    reading,
    meaning,
    example: null,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    cards: [],
  }) as unknown as WordWithCards;

const stats = (trueRetention: number | null) =>
  ({
    maturity: { new: 3, learning: 2, mature: 1 },
    dueToday: 4,
    overdue: 1,
    forecast: [],
    trueRetention,
    calibration: null,
    reviewsPerDay: [],
  }) as unknown as DeckStats;

describe("DeckTable", () => {
  const decks = [deck("DECK000001", "JLPT N5", 128, 12, "public"), deck("DECK000002", "Empty", 0, 0)];

  test("decks are rows under column headers", () => {
    render(<DeckTable decks={decks} onEdit={() => {}} onDelete={() => {}} />);

    const table = screen.getByRole("table", { name: "Decks" });
    const headers = within(table).getAllByRole("columnheader").map((header) => header.textContent);
    expect(headers).toEqual(["Deck", "Language", "Due", "Words", "Actions"]);

    const [first] = within(table).getAllByRole("row").slice(1);
    const row = within(first!);
    expect(row.getByRole("link", { name: "JLPT N5" }).getAttribute("href")).toBe("/app/decks/DECK000001");
    expect(row.getByText("ja → en")).toBeDefined();
    expect(row.getByText("Public")).toBeDefined();
    expect(row.getByRole("cell", { name: "12" })).toBeDefined();
    expect(row.getByRole("cell", { name: "128" })).toBeDefined();
    expect(row.getByRole("link", { name: "Study JLPT N5" }).getAttribute("href")).toBe("/app/decks/DECK000001/study");
  });

  test("a deck without words cannot be studied", () => {
    render(<DeckTable decks={decks} onEdit={() => {}} onDelete={() => {}} />);

    const study = screen.getByRole("button", { name: "Study Empty" });

    expect((study as HTMLButtonElement).disabled).toBe(true);
  });

  test("edit and delete live in the row's menu", async () => {
    const user = userEvent.setup();
    const onEdit = mock((_deck: DeckSummary) => {});
    const onDelete = mock((_deck: DeckSummary) => {});
    render(<DeckTable decks={decks} onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: "Actions for JLPT N5" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete deck" }));
    expect(onDelete).toHaveBeenCalledWith(decks[0]!);

    await user.click(screen.getByRole("button", { name: "Actions for JLPT N5" }));
    await user.click(screen.getByRole("menuitem", { name: "Edit deck" }));
    expect(onEdit).toHaveBeenCalledWith(decks[0]!);
  });
});

describe("WordTable", () => {
  const owner = deck("DECK000001", "JLPT N5", 2, 0) as unknown as Deck;
  const words = [word("WORD00000001", "食べる", "たべる", "to eat"), word("WORD00000002", "水", null, "water")];

  test("words are rows of term and meaning, the term in the deck's language", () => {
    render(<WordTable deck={owner} words={words} onEdit={() => {}} onDelete={() => {}} />);

    const table = screen.getByRole("table", { name: "Words" });
    const headers = within(table).getAllByRole("columnheader").map((header) => header.textContent);
    expect(headers).toEqual(["Term", "Meaning", "Actions"]);

    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText("to eat")).toBeDefined();
    expect(within(rows[0]!).getByText("たべる")).toBeDefined();
    expect(within(rows[0]!).getByText("食べる").closest("[lang]")?.getAttribute("lang")).toBe("ja");
  });

  test("edit and delete live in the row's menu, not as buttons on every row", async () => {
    const user = userEvent.setup();
    const onEdit = mock((_word: WordWithCards) => {});
    const onDelete = mock((_word: WordWithCards) => {});
    render(<WordTable deck={owner} words={words} onEdit={onEdit} onDelete={onDelete} />);

    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Actions for 水" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete word" }));
    expect(onDelete).toHaveBeenCalledWith(words[1]!);

    await user.click(screen.getByRole("button", { name: "Actions for 水" }));
    await user.click(screen.getByRole("menuitem", { name: "Edit word" }));
    expect(onEdit).toHaveBeenCalledWith(words[1]!);
  });
});

describe("DeckProgress", () => {
  test("the deck's numbers in one strip, and the maturity split", () => {
    render(<DeckProgress stats={stats(0.874)} />);

    const progress = screen.getByRole("region", { name: "Deck progress" });

    expect(within(progress).getAllByRole("term").map((term) => term.textContent)).toEqual([
      "Words",
      "Due today",
      "Overdue",
      "Retention",
    ]);
    expect(within(progress).getAllByRole("definition").map((value) => value.textContent)).toEqual([
      "6",
      "4",
      "1",
      "87%",
    ]);
    expect(within(progress).getByRole("img", { name: "New 3, learning 2, mature 1" })).toBeDefined();
  });

  test("retention without reviews yet is a dash", () => {
    render(<DeckProgress stats={stats(null)} />);

    const progress = screen.getByRole("region", { name: "Deck progress" });

    expect(within(progress).getAllByRole("definition").at(-1)?.textContent).toBe("—");
  });
});
