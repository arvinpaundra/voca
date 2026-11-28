import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import type { Word } from "@voca/contract";
import { WORD_FONT_CLASS } from "../../lib/wordFont";
import { WordDetailsModal } from "./WordDetailsModal";

const word = (term: string) =>
  ({
    slug: "WRD000000001",
    term,
    reading: null,
    meaning: "to buy",
    example: null,
    notes: null,
    createdAt: "2026-11-01T00:00:00.000Z",
  }) as unknown as Word;

const need = (ok: boolean, what: string) => {
  if (!ok) throw new Error(`not implemented: WM: ${what}`);
};

const titleOf = (term: string) => {
  const title = screen.getAllByRole("heading").find((heading) => heading.textContent === term);

  if (title === undefined) throw new Error(`not implemented: WM: no heading reads "${term}"`);

  return title;
};

const titleRuns = (term: string, termLang: string) => {
  render(<WordDetailsModal word={word(term)} termLang={termLang} meaningLang="en" onClose={() => {}} />);

  const title = titleOf(term);

  need(title.closest(`.${WORD_FONT_CLASS}`) === null, `the title "${term}" carries the word font as a whole`);

  return [...title.querySelectorAll(`.${WORD_FONT_CLASS}`)].map((run) => [run.textContent, run.getAttribute("lang")]);
};

describe("the word modal's title takes the word font character by character", () => {
  test("a mixed-script term: シャツ takes the face, T keeps the app font", () => {
    const runs = titleRuns("Tシャツ", "ja");

    need(runs.length > 0, "the title Tシャツ has no word font run");
    expect(runs).toEqual([["シャツ", "ja"]]);
  });

  test("a wholly CJK term is one run in the deck's language", () => {
    const runs = titleRuns("買う", "ja");

    need(runs.length > 0, "the title 買う has no word font run");
    expect(runs).toEqual([["買う", "ja"]]);
  });

  test("a term with no CJK character has no run", () => {
    expect(titleRuns("belajar", "id")).toEqual([]);
  });

  test("the dialog is still named by its term", () => {
    render(<WordDetailsModal word={word("Tシャツ")} termLang="ja" meaningLang="en" onClose={() => {}} />);

    const title = titleOf("Tシャツ");
    const dialog = screen.getByRole("dialog");

    expect(dialog.getAttribute("aria-labelledby")).toBe(title.id);
  });
});
