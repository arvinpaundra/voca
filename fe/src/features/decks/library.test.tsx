import { describe, expect, mock, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateTime } from "effect";
import type { Deck, DeckStats, DeckSummary, WordWithCards } from "@voca/contract";
import { DeckProgress } from "../deck/DeckProgress";
import { WordList } from "../deck/WordList";
import { DeckRows } from "./DeckRows";

// Markup and class names follow the Decks and Deck page screens of docs/design/ui-refinement.html (Console).

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

const card = (due: string, stabilityDays: number, isHard = false) => ({ drill: "term_meaning", due, stabilityDays, isHard });

const word = (slug: string, term: string, reading: string | null, meaning: string, example: string | null, cards: unknown[]) =>
  ({
    slug,
    term,
    reading,
    meaning,
    example,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    cards,
  }) as unknown as WordWithCards;

const NOW = DateTime.makeUnsafe("2026-11-18T12:00:00.000Z");

const stats = {
  maturity: { new: 48, learning: 96, mature: 104 },
  dueToday: 20,
  overdue: 0,
  forecast: [],
  trueRetention: 0.88,
  calibration: null,
  reviewsPerDay: [],
} as unknown as DeckStats;

const sorted = (element: Element | null | undefined) => [...(element?.classList ?? [])].sort();

describe("DeckRows", () => {
  const decks = [
    deck("DECK000001", "Japanese N5 verbs", 248, 20, "public"),
    deck("DECK000004", "Mandarin HSK 1", 150, 0),
    deck("DECK000006", "Korean honorifics", 0, 0),
  ];

  test("a .list-head over a .deck-grid of .deck rows", () => {
    const { container } = render(<DeckRows decks={decks} onEdit={() => {}} onDelete={() => {}} />);

    const list = screen.getByRole("list", { name: "Decks" });
    expect([...container.querySelectorAll(".list-head span")].map((span) => span.textContent)).toEqual([
      "Deck",
      "Languages",
      "Due",
      "Words",
      "",
      "",
    ]);

    expect(list.classList.contains("deck-grid")).toBe(true);

    const rows = list.querySelectorAll("li > article.deck");
    expect(rows).toHaveLength(3);

    const first = rows[0] as HTMLElement;
    expect(within(first).getByRole("link", { name: "Japanese N5 verbs" }).getAttribute("href")).toBe("/app/decks/DECK000001");
    expect(within(first).getByRole("link", { name: "Japanese N5 verbs" }).classList.contains("deck-title")).toBe(true);
    expect(sorted(within(first).getByText("ja → en"))).toEqual(["badge", "badge-outline", "lang"]);
    expect(sorted(within(first).getByText("Public"))).toEqual(["badge", "badge-lime"]);
    expect(first.querySelector(".deck-stats .due")?.textContent).toBe("20");
    expect(first.querySelector(".deck-stats .words-col .words")?.textContent).toBe("248");
  });

  test("Study is primary when words are due, secondary otherwise, and Add words when the deck is empty", () => {
    render(<DeckRows decks={decks} onEdit={() => {}} onDelete={() => {}} />);

    const due = screen.getByRole("link", { name: "Study Japanese N5 verbs" });
    expect(due.getAttribute("href")).toBe("/app/decks/DECK000001/study");
    expect(sorted(due)).toEqual(["btn", "btn-primary", "btn-sm"]);

    const idle = screen.getByRole("link", { name: "Study Mandarin HSK 1" });
    expect(sorted(idle)).toEqual(["btn", "btn-secondary", "btn-sm"]);

    const empty = screen.getByRole("link", { name: "Add words to Korean honorifics" });
    expect(empty.getAttribute("href")).toBe("/app/decks/DECK000006");
    expect(empty.textContent).toBe("Add words");

    expect(screen.getAllByRole("listitem")[1]?.querySelector(".due")?.classList.contains("zero")).toBe(true);
  });

  test("edit and delete live in the row's menu", async () => {
    const user = userEvent.setup();
    const onEdit = mock((_deck: DeckSummary) => {});
    const onDelete = mock((_deck: DeckSummary) => {});
    render(<DeckRows decks={decks} onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: "Actions for Japanese N5 verbs" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete deck" }));
    expect(onDelete).toHaveBeenCalledWith(decks[0]!);

    await user.click(screen.getByRole("button", { name: "Actions for Japanese N5 verbs" }));
    await user.click(screen.getByRole("menuitem", { name: "Edit deck" }));
    expect(onEdit).toHaveBeenCalledWith(decks[0]!);
  });
});

describe("WordList", () => {
  const owner = deck("DECK000001", "Japanese N5 verbs", 4, 1) as unknown as Deck;
  const words = [
    word("WRD000000001", "食べる", "たべる", "to eat", "毎朝パンを食べる。", [card("2026-11-18T00:00:00.000Z", 3)]),
    word("WRD000000002", "飲む", "のむ", "to drink", null, [card("2026-11-25T00:00:00.000Z", 8)]),
    word("WRD000000003", "行く", "いく", "to go", null, [card("2027-01-20T00:00:00.000Z", 40)]),
    word("WRD000000004", "見る", "みる", "to see, to watch", null, []),
  ];

  test("a .word-list of .word rows: term with its reading, meaning and example", () => {
    render(<WordList deck={owner} words={words} now={NOW} onEdit={() => {}} onDelete={() => {}} />);

    const list = screen.getByRole("list", { name: "Words" });
    expect(list.classList.contains("word-list")).toBe(true);

    const rows = list.querySelectorAll("li > article.word");
    expect(rows).toHaveLength(4);

    const term = rows[0]?.querySelector(".w-term");
    expect(term?.getAttribute("lang")).toBe("ja");
    expect(term?.querySelector("ruby")?.textContent).toBe("食べるたべる");
    expect(term?.querySelector("rt")?.textContent).toBe("たべる");
    expect(rows[0]?.querySelector(".w-body .w-meaning")?.textContent).toBe("to eat");
    expect(rows[0]?.querySelector(".w-body .w-meaning")?.getAttribute("lang")).toBe("en");
    expect(rows[0]?.querySelector(".w-body .w-example")?.textContent).toBe("毎朝パンを食べる。");
  });

  test("each word's state badge: due, learning, mature (21+ days), new", () => {
    render(<WordList deck={owner} words={words} now={NOW} onEdit={() => {}} onDelete={() => {}} />);

    const list = screen.getByRole("list", { name: "Words" });
    const badges = [...list.querySelectorAll(".w-state .badge")];

    expect(badges.map((badge) => badge.textContent)).toEqual(["Due", "Learning", "Mature", "New"]);
    expect(sorted(badges[0])).toEqual(["badge", "badge-lime"]);
    expect(sorted(badges[1])).toEqual(["badge"]);
    expect(sorted(badges[2])).toEqual(["badge", "badge-dot", "badge-navy"]);
    expect(sorted(badges[3])).toEqual(["badge"]);
  });

  test("edit and delete are icon buttons on each row", async () => {
    const user = userEvent.setup();
    const onEdit = mock((_word: WordWithCards) => {});
    const onDelete = mock((_word: WordWithCards) => {});
    render(<WordList deck={owner} words={words} now={NOW} onEdit={onEdit} onDelete={onDelete} />);

    const edit = screen.getByRole("button", { name: "Edit 飲む" });
    expect(edit.classList.contains("btn-icon")).toBe(true);
    expect(edit.closest(".w-actions")).not.toBeNull();

    await user.click(edit);
    expect(onEdit).toHaveBeenCalledWith(words[1]!);

    await user.click(screen.getByRole("button", { name: "Delete 飲む" }));
    expect(onDelete).toHaveBeenCalledWith(words[1]!);
  });
});

describe("DeckProgress", () => {
  test("a .deck-stats-strip of due today, new, learning, mature and the maturity bar", () => {
    render(<DeckProgress stats={stats} />);

    const strip = screen.getByRole("region", { name: "Deck progress" });
    expect(strip.classList.contains("deck-stats-strip")).toBe(true);

    expect(within(strip).getAllByRole("term").map((term) => term.textContent)).toEqual(["due today", "new", "learning", "mature"]);
    expect(within(strip).getAllByRole("definition").map((value) => value.textContent)).toEqual(["20", "48", "96", "104"]);

    const bar = within(strip).getByRole("img", { name: "New 48, learning 96, mature 104" });
    expect(bar.classList.contains("mbar")).toBe(true);
    expect(bar.closest(".wide.maturity")).not.toBeNull();
  });
});
