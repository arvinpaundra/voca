import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import type { Word } from "@voca/contract";
import { WordDetailsModal } from "../deck/WordDetailsModal";
import { WordHero } from "./WordHero";

// A long term or example must wrap inside a phone's width: the word page and the word modal never scroll sideways
// and keep all of their text. happy-dom lays nothing out, so the stylesheet is read as text: what has to be there is
// a rule that lets the text break anywhere, and the box that holds it shrink to its container.

const css = (await Bun.file(new URL("../../styles/console.css", import.meta.url)).text()).replace(/\/\*[\s\S]*?\*\//g, "");

// The declarations of every rule that lists `selector` (a rule may list several, separated by commas).
const declarationsOf = (selector: string): ReadonlyArray<readonly [string, string]> =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, list]) => list!.split(",").some((entry) => entry.trim() === selector))
    .flatMap(([, , body]) => body!.split(";"))
    .map((declaration) => declaration.split(":"))
    .filter((parts) => parts.length >= 2)
    .map(([name, ...value]) => [name!.trim(), value.join(":").trim()] as const);

const declares = (selector: string, property: string, values: readonly string[]) =>
  declarationsOf(selector).some(([name, value]) => name === property && values.includes(value));

const breaksAnywhere = (selector: string) =>
  declares(selector, "overflow-wrap", ["anywhere", "break-word"]) || declares(selector, "word-break", ["break-word", "break-all"]);

const need = (ok: boolean, what: string) => {
  if (!ok) throw new Error(`not implemented: FIT: ${what}`);
};

describe("the word page header", () => {
  test("the hero's text breaks anywhere", () => {
    need(breaksAnywhere(".word-hero"), "`.word-hero` has no overflow-wrap: anywhere (term, reading, meaning and example inherit it)");
  });

  test("the hero never grows past the header", () => {
    need(declares(".word-hero", "max-width", ["100%"]), "`.word-hero` has no max-width: 100%");
    need(declares(".word-hero", "min-width", ["0"]), "`.word-hero` has no min-width: 0");
  });

  test("the hero shows all of its text, with no clipping rule", () => {
    const word = {
      slug: "WRD000000001",
      term: "あ".repeat(30),
      reading: "a".repeat(30),
      meaning: "meaning",
      example: "例".repeat(300),
      notes: null,
      createdAt: "2026-10-01T00:00:00.000Z",
    } as unknown as Word;

    render(<WordHero word={word} termLang="ja" meaningLang="en" />);

    expect(screen.getByText(word.example!)).toBeDefined();
    expect(document.querySelector(".word-hero .t")?.textContent).toBe(word.term + word.reading);

    for (const selector of [".word-hero", ".word-hero .t", ".word-hero .m"]) {
      expect(declares(selector, "text-overflow", ["ellipsis"])).toBe(false);
      expect(declares(selector, "overflow", ["hidden"])).toBe(false);
    }
  });
});

describe("the word modal", () => {
  const word = {
    slug: "WRD000000001",
    term: "あ".repeat(30),
    reading: "a".repeat(30),
    meaning: "m".repeat(80),
    example: "例".repeat(300),
    notes: "n".repeat(200),
    createdAt: "2026-10-01T00:00:00.000Z",
  } as unknown as Word;

  test("its title, reading, meaning, example and notes sit in boxes that break anywhere", () => {
    need(breaksAnywhere(".modal-head h3"), "`.modal-head h3` (the title) has no overflow-wrap: anywhere");
    need(breaksAnywhere(".modal-body"), "`.modal-body` has no overflow-wrap: anywhere");
  });

  test("the modal never grows past the screen", () => {
    need(declares(".modal", "max-width", ["100%"]) || declares(".modal", "width", ["min(480px, 100%)"]), "`.modal` can be wider than the screen");
    need(declares(".modal-head h3", "min-width", ["0"]) || declares(".modal-head > div", "min-width", ["0"]), "the modal's title box cannot shrink (no min-width: 0)");
  });

  test("it shows all of the word's text in the title and the body", () => {
    render(<WordDetailsModal word={word} termLang="ja" meaningLang="en" onClose={() => {}} />);

    expect(screen.getByRole("heading", { name: word.term }).closest(".modal-head")).not.toBeNull();
    expect(screen.getByText(word.example!).closest(".modal-body")).not.toBeNull();
    expect(screen.getByText(word.notes!).closest(".modal-body")).not.toBeNull();
    expect(screen.getByText(word.meaning).closest(".modal-body")).not.toBeNull();
  });
});
