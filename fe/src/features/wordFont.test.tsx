import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { DateTime } from "effect";
import type { Deck, Question, Word, WordWithCards } from "@voca/contract";
import { Term } from "../components/Term";
import { WORD_FONT_CLASS } from "../lib/wordFont";
import { WordDetailsModal } from "./deck/WordDetailsModal";
import { WordList } from "./deck/WordList";
import { CardBack } from "./flashcards/CardBack";
import { AnswerOptions } from "./study/AnswerOptions";
import { QuestionPrompt } from "./study/QuestionPrompt";
import { SessionWords } from "./study/SessionWords";
import { Verdict } from "./study/Verdict";
import { WordHero } from "./word/WordHero";

// Every piece of a word's content (term, reading, meaning, example, notes) carries the word font class wherever it
// is shown, for any language pair. The interface around it (buttons, labels, headings) never does.

const NOW = DateTime.makeUnsafe("2026-11-22T12:00:00.000Z");

type Pair = {
  readonly name: string;
  readonly termLang: string;
  readonly meaningLang: string;
  readonly word: Word;
  readonly fields: readonly string[];
  readonly distractors: readonly string[];
};

const word = (slug: string, term: string, reading: string | null, meaning: string, example: string | null, notes: string | null) =>
  ({ slug, term, reading, meaning, example, notes, createdAt: "2026-11-01T00:00:00.000Z" }) as unknown as Word;

const PAIRS: readonly Pair[] = [
  {
    name: "ja → id",
    termLang: "ja",
    meaningLang: "id",
    word: word("WRD000000001", "食べる", "たべる", "makan", "朝ごはんを食べる", "kata kerja ichidan"),
    fields: ["食べる", "たべる", "makan", "朝ごはんを食べる", "kata kerja ichidan"],
    distractors: ["minum", "tidur", "melihat"],
  },
  {
    name: "id → en",
    termLang: "id",
    meaningLang: "en",
    word: word("WRD000000002", "makan", null, "to eat", "Saya makan nasi.", "a common verb"),
    fields: ["makan", "to eat", "Saya makan nasi.", "a common verb"],
    distractors: ["to drink", "to sleep", "to see"],
  },
];

const deckOf = (pair: Pair) =>
  ({ slug: "DECK000001", title: "Verbs", termLang: pair.termLang, meaningLang: pair.meaningLang }) as unknown as Deck;

const listed = (entry: Word) => ({ ...entry, cards: [] }) as unknown as WordWithCards;

const fieldsOf = (pair: Pair, keep: (field: "term" | "reading" | "meaning" | "example" | "notes") => boolean) => {
  const { term, reading, meaning, example, notes } = pair.word;
  const all = [
    ["term", term],
    ["reading", reading],
    ["meaning", meaning],
    ["example", example],
    ["notes", notes],
  ] as const;

  return all.filter(([field, text]) => text !== null && keep(field)).map(([, text]) => text as string);
};

const ownText = (element: Element) =>
  [...element.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent)
    .join("")
    .trim();

// The elements that show `text` on their own: as their own text, or as the innermost element whose text it is.
const occurrences = (text: string) =>
  [...document.body.querySelectorAll("*")].filter((element) => {
    if (ownText(element) === text) return true;
    if (element.textContent?.trim() !== text) return false;

    return ![...element.children].some((child) => child.textContent?.trim() === text);
  });

const inWordFont = (element: Element) => element.closest(`.${WORD_FONT_CLASS}`) !== null;

const expectWordFont = (surface: string, texts: readonly string[]) => {
  for (const text of texts) {
    const shown = occurrences(text);

    if (shown.length === 0) throw new Error(`not implemented: WF: ${surface} does not show "${text}" in an element of its own`);

    if (!shown.every(inWordFont)) throw new Error(`not implemented: WF: ${surface} shows "${text}" outside the word font`);
  }
};

const expectInterfaceFont = (elements: readonly Element[]) => {
  for (const element of elements) expect({ text: element.textContent, inWordFont: inWordFont(element) }).toEqual({ text: element.textContent, inWordFont: false });
};

const question = (pair: Pair): Question =>
  ({
    position: 1,
    attempt: 1,
    wordSlug: pair.word.slug,
    drill: "term_meaning",
    drillLabel: "Word → Meaning",
    prompt: { text: pair.word.term, ruby: null },
    options: [pair.word.meaning, ...pair.distractors].map((text, index) => ({ wordSlug: `WRD00000010${index}`, text })),
  }) as unknown as Question;

describe.each([...PAIRS])("a $name word", (pair) => {
  test("on the deck page: term, reading, meaning and example; the row's buttons and badge keep the interface font", () => {
    render(
      <WordList deck={deckOf(pair)} words={[listed(pair.word)]} now={NOW} onOpen={() => {}} onEdit={() => {}} onDelete={() => {}} />,
    );

    expectWordFont("the deck page", fieldsOf(pair, (field) => field !== "notes"));
    expectInterfaceFont([
      screen.getByRole("button", { name: `Edit ${pair.word.term}` }),
      screen.getByRole("button", { name: `Delete ${pair.word.term}` }),
      screen.getByText("New"),
    ]);
  });

  test("in the word modal: all of its content, the title too; labels and Close keep the interface font", () => {
    render(<WordDetailsModal word={pair.word} termLang={pair.termLang} meaningLang={pair.meaningLang} onClose={() => {}} />);

    expectWordFont("the word modal", fieldsOf(pair, () => true));
    expectInterfaceFont([screen.getByText("Example"), screen.getByText("Notes"), screen.getByRole("button", { name: "Close" })]);
  });

  test("on the word page: term, reading, meaning and example", () => {
    render(<WordHero word={pair.word} termLang={pair.termLang} meaningLang={pair.meaningLang} />);

    expectWordFont("the word page", fieldsOf(pair, (field) => field !== "notes"));
  });

  test("in a study session: the prompt and the options; the drill label and keys keep the interface font", () => {
    render(
      <>
        <QuestionPrompt question={question(pair)} termLang={pair.termLang} />
        <AnswerOptions options={question(pair).options} correctSlug={null} chosenSlug={null} onChoose={() => {}} />
      </>,
    );

    expectWordFont("the study question", [pair.word.term, pair.word.meaning, ...pair.distractors]);
    expectInterfaceFont([screen.getByText("Word → Meaning"), screen.getByText("1"), ...screen.getAllByRole("button")]);
  });

  test("in a study session: the verdict's term, answer and reading; its message and Next keep the interface font", () => {
    render(
      <Verdict
        correct={false}
        term={pair.word.term}
        answer={pair.word.meaning}
        reading={pair.word.reading}
        readingLang={pair.termLang}
        onNext={() => {}}
      />,
    );

    expectWordFont("the verdict", fieldsOf(pair, (field) => field === "term" || field === "reading" || field === "meaning"));
    expectInterfaceFont([screen.getByText("Not quite."), screen.getByRole("button", { name: "Next" })]);
  });

  test("in a study session: the words of the session; its heading and buttons keep the interface font", () => {
    render(
      <SessionWords
        items={[
          {
            wordSlug: pair.word.slug,
            drill: "term_meaning",
            term: pair.word.term,
            meaning: pair.word.meaning,
            lang: pair.termLang,
            correct: true,
            leech: false,
            hard: false,
          },
        ]}
        drillLabel="Word → Meaning"
        onToggleHard={() => {}}
      />,
    );

    expectWordFont("the session words", [pair.word.term, pair.word.meaning]);
    expectInterfaceFont([
      screen.getByRole("heading", { name: "Words in this session" }),
      screen.getByRole("button", { name: `Mark ${pair.word.term} hard` }),
    ]);
  });

  test("on a flashcard: the term on the front, the rest on the back", () => {
    const front = render(<Term term={pair.word.term} lang={pair.termLang} size="lg" />);

    expectWordFont("the flashcard front", [pair.word.term]);

    front.unmount();
    render(<CardBack card={pair.word} termLang={pair.termLang} />);

    expectWordFont("the flashcard back", fieldsOf(pair, (field) => field !== "term"));
  });
});
