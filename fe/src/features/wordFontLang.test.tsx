import { beforeEach, describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { DateTime } from "effect";
import type { Deck, Question, Word, WordWithCards } from "@voca/contract";
import { readingLang } from "@voca/contract";
import { Term } from "../components/Term";
import { WORD_FONT_CLASS } from "../lib/wordFont";
import { WordDetailsModal } from "./deck/WordDetailsModal";
import { WordList } from "./deck/WordList";
import { CardBack } from "./flashcards/CardBack";
import { WordFontSection } from "./settings/WordFontSection";
import { AnswerOptions } from "./study/AnswerOptions";
import { QuestionPrompt } from "./study/QuestionPrompt";
import { Verdict } from "./study/Verdict";
import { WordHero } from "./word/WordHero";

// The word font reaches CJK content through `:lang()`, so a term or kana reading must sit inside the word font class
// AND resolve to its CJK language: either the class is on an element of that language, or the language is set on an
// element inside it. The stylesheet matches both shapes.

const NOW = DateTime.makeUnsafe("2026-11-22T12:00:00.000Z");

const TERM_LANG = "ja";

const EAT = {
  slug: "WRD000000001",
  term: "食べる",
  reading: "たべる",
  meaning: "makan",
  example: "朝ごはんを食べる",
  notes: null,
  createdAt: "2026-11-01T00:00:00.000Z",
} as unknown as Word;

const deck = { slug: "DECK000001", title: "Verbs", termLang: "ja", meaningLang: "id" } as unknown as Deck;

const ownText = (element: Element) =>
  [...element.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent)
    .join("")
    .trim();

const occurrences = (text: string) =>
  [...document.body.querySelectorAll("*")].filter((element) => {
    if (ownText(element) === text) return true;
    if (element.textContent?.trim() !== text) return false;

    return ![...element.children].some((child) => child.textContent?.trim() === text);
  });

const langOf = (element: Element) => element.closest("[lang]")?.getAttribute("lang") ?? null;

// Every element showing `text` is word content in `lang`.
const expectCjkWordFont = (surface: string, text: string, lang: string) => {
  const shown = occurrences(text);

  if (shown.length === 0) throw new Error(`not implemented: WL: ${surface} does not show "${text}"`);

  for (const element of shown) {
    if (element.closest(`.${WORD_FONT_CLASS}`) === null || langOf(element) !== lang) {
      throw new Error(`not implemented: WL: ${surface} shows "${text}" as ${langOf(element) ?? "no language"}, outside the ${lang} word font`);
    }
  }
};

const question = {
  position: 1,
  attempt: 1,
  wordSlug: EAT.slug,
  drill: "meaning_term",
  drillLabel: "Meaning → Word",
  prompt: { text: "makan", ruby: null },
  options: ["食べる", "飲む", "寝る", "見る"].map((text, index) => ({ wordSlug: `WRD00000010${index}`, text })),
} as unknown as Question;

describe("CJK word content resolves to its language inside the word font", () => {
  test("the deck page", () => {
    render(
      <WordList deck={deck} words={[{ ...EAT, cards: [] } as unknown as WordWithCards]} now={NOW} onOpen={() => {}} onEdit={() => {}} onDelete={() => {}} />,
    );

    expectCjkWordFont("the deck page", EAT.term, TERM_LANG);
    expectCjkWordFont("the deck page", EAT.reading as string, readingLang(TERM_LANG));
  });

  test("the word modal, its title too", () => {
    render(<WordDetailsModal word={EAT} termLang={deck.termLang} meaningLang={deck.meaningLang} onClose={() => {}} />);

    expectCjkWordFont("the word modal", EAT.term, TERM_LANG);
    expectCjkWordFont("the word modal", EAT.reading as string, TERM_LANG);
  });

  test("the word page", () => {
    render(<WordHero word={EAT} termLang={deck.termLang} meaningLang={deck.meaningLang} />);

    expectCjkWordFont("the word page", EAT.term, TERM_LANG);
    expectCjkWordFont("the word page", EAT.reading as string, readingLang(TERM_LANG));
  });

  test("a study question whose options are terms", () => {
    render(
      <>
        <QuestionPrompt question={question} termLang={TERM_LANG} />
        <AnswerOptions options={question.options} correctSlug={null} chosenSlug={null} lang={TERM_LANG} onChoose={() => {}} />
      </>,
    );

    expectCjkWordFont("the study options", "食べる", TERM_LANG);
  });

  test("the verdict: its term and reading", () => {
    render(
      <Verdict
        correct={false}
        term={EAT.term}
        answer={EAT.meaning}
        reading={EAT.reading}
        readingLang={readingLang(TERM_LANG)}
        termLang={TERM_LANG}
        onNext={() => {}}
      />,
    );

    expectCjkWordFont("the verdict", EAT.term, TERM_LANG);
    expectCjkWordFont("the verdict", EAT.reading as string, readingLang(TERM_LANG));
  });

  test("a flashcard", () => {
    const front = render(<Term term={EAT.term} lang={TERM_LANG} size="lg" />);

    expectCjkWordFont("the flashcard front", EAT.term, TERM_LANG);

    front.unmount();
    render(<CardBack card={EAT} termLang={TERM_LANG} />);

    expectCjkWordFont("the flashcard back", EAT.reading as string, readingLang(TERM_LANG));
  });
});

describe("the settings preview", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("its CJK sample is word content in ja, under the select in the same row", () => {
    render(<WordFontSection />);

    expectCjkWordFont("the settings preview", "勉強", "ja");

    const preview = occurrences("勉強")[0]?.closest(`.${WORD_FONT_CLASS}`);
    const row = screen.getByLabelText("Word font").closest(".set-row");

    if (row === null || preview === null || preview === undefined || !row.contains(preview)) {
      throw new Error("not implemented: WL: the preview sits outside the Word font row");
    }
  });
});

describe("the stylesheet", () => {
  const CJK = ["ja", "zh-Hans", "zh-Hant", "ko"];

  test("every style also reaches CJK content set inside a .word-font element", async () => {
    const css = (await Bun.file(new URL("../styles/globals.css", import.meta.url)).text()).replace(/\s+/g, " ");

    for (const style of ["sans", "serif", "rounded", "handwriting"]) {
      for (const lang of CJK) {
        const nested = new RegExp(`data-word-font="${style}"\\][^{]*\\.word-font :lang\\(${lang}\\)`);

        if (!nested.test(css)) throw new Error(`not implemented: WL: ${style} does not reach :lang(${lang}) inside .word-font`);
      }
    }

    expect(true).toBe(true);
  });
});
