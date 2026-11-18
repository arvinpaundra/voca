import { describe, expect, mock, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateTime } from "effect";
import { drillLabel, type Drill, type HardWord, type SessionSize } from "@voca/contract";
import { SessionWords, type SessionWordItem } from "../study/SessionWords";
import { HardStudySetup } from "./HardStudySetup";
import { hardDrills } from "./hardDrills";
import { HardWordList } from "./HardWordList";

// Markup and class names follow the Hard words and session words screens of docs/design/ui-refinement.html (Console).

const NOW = DateTime.makeUnsafe("2026-11-18T12:00:00.000Z");

const card = (drill: string, due: string) => ({ drill, due, stabilityDays: 4, isHard: true });

const hardWord = (
  slug: string,
  term: string,
  reading: string | null,
  meaning: string,
  deck: { slug: string; title: string; termLang: string },
  cards: unknown[],
) =>
  ({
    slug,
    term,
    reading,
    meaning,
    example: null,
    notes: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    cards,
    deck: { ...deck, meaningLang: "en" },
  }) as unknown as HardWord;

const verbs = { slug: "DECK000001", title: "Japanese N5 verbs", termLang: "ja" };
const hanzi = { slug: "DECK000004", title: "Mandarin HSK 1", termLang: "zh" };

const words = [
  hardWord("WRD000000001", "食べる", "たべる", "to eat", verbs, [card("term_meaning", "2026-11-18T00:00:00.000Z")]),
  hardWord("WRD000000006", "学习", "xuéxí", "to study", hanzi, [card("reading_term", "2026-11-25T00:00:00.000Z")]),
  hardWord("WRD000000007", "飲む", "のむ", "to drink", verbs, [card("term_meaning", "2026-11-30T00:00:00.000Z")]),
];

const sorted = (element: Element | null | undefined) => [...(element?.classList ?? [])].sort();

describe("HardWordList", () => {
  test("a .word-list of hard words: term in its deck's language, meaning, deck, due and drill badges", () => {
    render(<HardWordList words={words} now={NOW} onUnmark={() => {}} />);

    const list = screen.getByRole("list", { name: "Hard words" });
    expect(list.classList.contains("word-list")).toBe(true);

    const rows = [...list.querySelectorAll("li > article.word")];
    expect(rows).toHaveLength(3);

    const first = rows[0] as HTMLElement;
    expect(first.querySelector(".w-term")?.getAttribute("lang")).toBe("ja");
    expect(first.querySelector(".w-term rt")?.textContent).toBe("たべる");
    expect(within(first).getByRole("link", { name: /食べる/ }).getAttribute("href")).toBe("/app/decks/DECK000001/words/WRD000000001");
    expect(first.querySelector(".w-body .w-meaning")?.textContent).toBe("to eat");
    expect(first.querySelector(".w-body .w-deck")?.textContent).toBe("Japanese N5 verbs");

    const badges = [...first.querySelectorAll(".w-state .badge")];
    expect(badges.map((badge) => badge.textContent)).toEqual(["Due", drillLabel("ja", "term_meaning")]);
    expect(sorted(badges[0])).toEqual(["badge", "badge-lime"]);

    expect(rows[1]?.querySelector(".w-term")?.getAttribute("lang")).toBe("zh");
    expect([...rows[1]!.querySelectorAll(".w-state .badge")].map((badge) => badge.textContent)).toEqual([drillLabel("zh", "reading_term")]);
  });

  test("the x on a row unmarks that word", async () => {
    const user = userEvent.setup();
    const onUnmark = mock((_word: HardWord) => {});
    render(<HardWordList words={words} now={NOW} onUnmark={onUnmark} />);

    const unmark = screen.getByRole("button", { name: "Unmark 学习 as hard" });
    expect(unmark.classList.contains("btn-icon")).toBe(true);
    expect(unmark.closest(".w-actions")).not.toBeNull();

    await user.click(unmark);
    expect(onUnmark).toHaveBeenCalledWith(words[1]!);
  });
});

describe("hard words study", () => {
  test("the drills with hard cards, how many, in drill order", () => {
    expect(hardDrills(words)).toEqual([
      { drill: "term_meaning", label: drillLabel("ja", "term_meaning"), count: 2 },
      { drill: "reading_term", label: drillLabel("zh", "reading_term"), count: 1 },
    ]);
  });

  test("the setup card: a choice per drill, the size, and Start session with the chosen drills", async () => {
    const user = userEvent.setup();
    const onStart = mock((_drills: readonly Drill[], _size: SessionSize) => {});
    render(<HardStudySetup drills={hardDrills(words)} defaultSize={10} onStart={onStart} />);

    const title = screen.getByRole("heading", { level: 1, name: "Study hard words" });
    expect(title.closest(".card")).not.toBeNull();

    const meaning = screen.getByRole("checkbox", { name: new RegExp(drillLabel("ja", "term_meaning")) });
    const reading = screen.getByRole("checkbox", { name: new RegExp(drillLabel("zh", "reading_term")) });
    expect((meaning as HTMLInputElement).checked).toBe(true);
    expect((reading as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("2 hard").classList.contains("m")).toBe(true);

    await user.click(reading);
    await user.click(within(screen.getByRole("radiogroup", { name: "Session size" })).getByRole("radio", { name: "15" }));

    const start = screen.getByRole("button", { name: "Start session" });
    expect(sorted(start)).toEqual(["btn", "btn-primary"]);
    await user.click(start);

    expect(onStart).toHaveBeenCalledWith(["term_meaning"], 15);
  });
});

describe("SessionWords", () => {
  const item = (term: string, meaning: string, correct: boolean, leech: boolean, hard: boolean): SessionWordItem => ({
    wordSlug: `W-${term}`,
    drill: "term_meaning",
    term,
    meaning,
    lang: "ja",
    correct,
    leech,
    hard,
  });

  const items = [item("飲む", "to drink", false, true, false), item("行く", "to go", false, false, true), item("食べる", "to eat", true, false, false)];

  test("a card of the session's words: result mark, leech suggestion, and the hard toggle", () => {
    render(<SessionWords items={items} drillLabel="Term → Meaning" onToggleHard={() => {}} />);

    const card = screen.getByRole("region", { name: "Words in this session" });
    expect(card.classList.contains("card")).toBe(true);
    expect(within(card).getByRole("heading", { level: 2, name: "Words in this session" })).toBeDefined();
    expect(within(card).getByText("Term → Meaning")).toBeDefined();

    const rows = [...card.querySelectorAll(".word-list li > article.word")];
    expect(rows).toHaveLength(3);
    expect(rows[0]?.querySelector(".w-term")?.getAttribute("lang")).toBe("ja");
    expect(rows[0]?.querySelector(".w-meaning")?.textContent).toBe("to drink");
    expect(rows.map((row) => row.querySelector(".w-mark")?.className)).toEqual(["w-mark w", "w-mark w", "w-mark"]);
    expect(sorted(within(rows[0] as HTMLElement).getByText("Suggested"))).toEqual(["badge", "badge-lime"]);
    expect(within(rows[1] as HTMLElement).queryByText("Suggested")).toBeNull();

    const mark = within(rows[0] as HTMLElement).getByRole("button", { name: "Mark 飲む hard" });
    expect(sorted(mark)).toEqual(["btn", "btn-secondary", "btn-sm"]);
    expect(mark.textContent).toBe("Mark hard");

    const unmark = within(rows[1] as HTMLElement).getByRole("button", { name: "Unmark 行く" });
    expect(sorted(unmark)).toEqual(["btn", "btn-ghost", "btn-sm"]);
    expect(unmark.textContent).toBe("Hard");
  });

  test("the toggle reports the word", async () => {
    const user = userEvent.setup();
    const onToggleHard = mock((_item: SessionWordItem) => {});
    render(<SessionWords items={items} drillLabel="Term → Meaning" onToggleHard={onToggleHard} />);

    await user.click(screen.getByRole("button", { name: "Mark 食べる hard" }));
    expect(onToggleHard).toHaveBeenCalledWith(items[2]!);

    await user.click(screen.getByRole("button", { name: "Unmark 行く" }));
    expect(onToggleHard).toHaveBeenCalledWith(items[1]!);
  });
});
