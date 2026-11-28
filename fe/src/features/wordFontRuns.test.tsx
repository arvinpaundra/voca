import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { DateTime } from "effect";
import type { Deck, Question, Word, WordWithCards } from "@voca/contract";
import { readingLang } from "@voca/contract";
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

const NOW = DateTime.makeUnsafe("2026-11-22T12:00:00.000Z");

const CJK = /(?![\u0000-⹿])[\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{scx=Hangul}]/u;

const ALL_CJK = /^(?:(?![\u0000-⹿])[\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{scx=Hangul}])+$/u;

type Field = "term" | "reading" | "meaning" | "example" | "notes";

type Pair = {
  readonly name: string;
  readonly termLang: string;
  readonly meaningLang: string;
  readonly word: Word;
  readonly distractors: readonly string[];
};

const word = (slug: string, term: string, reading: string | null, meaning: string, example: string | null, notes: string | null) =>
  ({ slug, term, reading, meaning, example, notes, createdAt: "2026-11-01T00:00:00.000Z" }) as unknown as Word;

const PAIRS: readonly Pair[] = [
  {
    name: "ja → en",
    termLang: "ja",
    meaningLang: "en",
    word: word("WRD000000001", "買う", "かう", "to buy", "セールでTシャツを3枚買った。", "Polite form: 買います. Past: 買った."),
    distractors: ["to sell", "to borrow", "to write"],
  },
  {
    name: "zh-Hans → en",
    termLang: "zh-Hans",
    meaningLang: "en",
    word: word("WRD000000002", "学习", "xuéxí", "to study", "我每天学习2个小时。", null),
    distractors: ["to teach", "to read", "to rest"],
  },
  {
    name: "id → en",
    termLang: "id",
    meaningLang: "en",
    word: word("WRD000000003", "belajar", null, "to study", "Saya belajar 2 jam setiap hari.", "a common verb"),
    distractors: ["to teach", "to read", "to rest"],
  },
];

const deckOf = (pair: Pair) =>
  ({ slug: "DECK000001", title: "Verbs", termLang: pair.termLang, meaningLang: pair.meaningLang }) as unknown as Deck;

const listed = (entry: Word) => ({ ...entry, cards: [] }) as unknown as WordWithCards;

const textsOf = (pair: Pair, fields: readonly Field[]) =>
  fields.map((field) => pair.word[field]).filter((text): text is string => text !== null);

const textNodes = (root: Node): Text[] => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];

  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) nodes.push(node as Text);

  return nodes;
};

const runsShown = () => [...document.body.querySelectorAll(`.${WORD_FONT_CLASS}`)];

const expectShown = (surface: string, texts: readonly string[]) => {
  const shown = document.body.textContent ?? "";

  for (const text of texts) {
    if (!shown.includes(text)) throw new Error(`not implemented: WF: ${surface} does not show "${text}"`);
  }
};

const expectOnlyCjkRuns = (surface: string, faceLang: string) => {
  for (const element of runsShown()) {
    const text = element.textContent ?? "";

    if (!ALL_CJK.test(text)) throw new Error(`not implemented: WF: ${surface} puts "${text}" in the word font`);

    if (element.getAttribute("lang") !== faceLang) {
      throw new Error(`not implemented: WF: ${surface} sets "${text}" in ${element.getAttribute("lang") ?? "no language"}, not ${faceLang}`);
    }

    if (element.querySelector(`.${WORD_FONT_CLASS}`) !== null) throw new Error(`not implemented: WF: ${surface} nests the word font in "${text}"`);
  }

  for (const node of textNodes(document.body)) {
    const text = node.textContent ?? "";

    if (CJK.test(text) && node.parentElement?.closest(`.${WORD_FONT_CLASS}`) == null) {
      throw new Error(`not implemented: WF: ${surface} leaves "${text}" outside the word font`);
    }
  }
};

const expectRuns = (surface: string, pair: Pair, fields: readonly Field[]) => {
  expectShown(surface, textsOf(pair, fields));
  expectOnlyCjkRuns(surface, pair.termLang);

  const cjkShown = textsOf(pair, fields).some((text) => CJK.test(text));

  if (!cjkShown && runsShown().length > 0) throw new Error(`not implemented: WF: ${surface} uses the word font for a ${pair.name} word`);
};

const expectRunsInclude = (surface: string, texts: readonly string[]) => {
  const runs = runsShown().map((element) => element.textContent);

  for (const text of texts) {
    if (!runs.includes(text)) throw new Error(`not implemented: WF: ${surface} has no word font run "${text}"`);
  }
};

const expectNoRunWith = (surface: string, fragment: string) => {
  const found = runsShown().find((element) => element.textContent?.includes(fragment));

  if (found !== undefined) throw new Error(`not implemented: WF: ${surface} puts "${found.textContent}" in the word font`);
};

const question = (pair: Pair, drill: "term_meaning" | "meaning_term"): Question => {
  const promptIsTerm = drill === "term_meaning";
  const answers = promptIsTerm ? [pair.word.meaning, ...pair.distractors] : [pair.word.term, "売る", "借りる", "書く"];

  return {
    position: 1,
    attempt: 1,
    wordSlug: pair.word.slug,
    drill,
    drillLabel: promptIsTerm ? "Word → Meaning" : "Meaning → Word",
    prompt: { text: promptIsTerm ? pair.word.term : pair.word.meaning, ruby: null },
    options: answers.map((text, index) => ({ wordSlug: `WRD00000010${index}`, text })),
  } as unknown as Question;
};

describe.each([...PAIRS])("a $name word with Handwriting chosen", (pair) => {
  test("the deck page: only its CJK characters take the word font", () => {
    render(<WordList deck={deckOf(pair)} words={[listed(pair.word)]} now={NOW} onOpen={() => {}} onEdit={() => {}} onDelete={() => {}} />);

    expectRuns("the deck page", pair, ["term", "reading", "meaning", "example"]);
  });

  test("the word modal: only its CJK characters take the word font, the notes too", () => {
    render(<WordDetailsModal word={pair.word} termLang={pair.termLang} meaningLang={pair.meaningLang} onClose={() => {}} />);

    expectRuns("the word modal", pair, ["term", "reading", "meaning", "example", "notes"]);
  });

  test("the word page: only its CJK characters take the word font", () => {
    render(<WordHero word={pair.word} termLang={pair.termLang} meaningLang={pair.meaningLang} />);

    expectRuns("the word page", pair, ["term", "reading", "meaning", "example"]);
  });

  test("a study question with the term as its prompt", () => {
    const shown = question(pair, "term_meaning");

    render(
      <>
        <QuestionPrompt question={shown} termLang={pair.termLang} />
        <AnswerOptions options={shown.options} correctSlug={null} chosenSlug={null} faceLang={pair.termLang} onChoose={() => {}} />
      </>,
    );

    expectRuns("the study question", pair, ["term", "meaning"]);
  });

  test("the verdict: its term, answer and reading", () => {
    render(
      <Verdict
        correct={false}
        term={pair.word.term}
        answer={pair.word.meaning}
        reading={pair.word.reading}
        readingLang={readingLang(pair.termLang)}
        termLang={pair.termLang}
        faceLang={pair.termLang}
        onNext={() => {}}
      />,
    );

    expectRuns("the verdict", pair, ["term", "reading", "meaning"]);
  });

  test("the words of a finished session", () => {
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

    expectRuns("the session words", pair, ["term", "meaning"]);
  });

  test("a flashcard: the term on the front, the rest on the back", () => {
    const reading = pair.word.reading === null ? {} : { reading: pair.word.reading };
    const front = render(<Term term={pair.word.term} {...reading} lang={pair.termLang} readingLang={readingLang(pair.termLang)} size="lg" />);

    expectRuns("the flashcard front", pair, ["term"]);

    front.unmount();
    render(<CardBack card={pair.word} termLang={pair.termLang} />);

    expectRuns("the flashcard back", pair, ["reading", "meaning", "example", "notes"]);
  });
});

describe("a Japanese word with Handwriting chosen", () => {
  const ja = PAIRS[0] as Pair;

  test("the example: its kana and kanji take the face, T and 3 keep the app font", () => {
    render(<WordDetailsModal word={ja.word} termLang="ja" meaningLang="en" onClose={() => {}} />);

    expectRunsInclude("the example", ["セールで", "シャツを", "枚買った。"]);
    expectNoRunWith("the example", "T");
    expectNoRunWith("the example", "3");
  });

  test("the notes: 買います takes the face, Polite form: keeps the app font", () => {
    render(<WordDetailsModal word={ja.word} termLang="ja" meaningLang="en" onClose={() => {}} />);

    expectRunsInclude("the notes", ["買います", "買った"]);
    expectNoRunWith("the notes", "Polite");
  });

  test("a question whose options are terms: each option's CJK characters take the face", () => {
    const shown = question(ja, "meaning_term");

    render(
      <>
        <QuestionPrompt question={shown} termLang="ja" />
        <AnswerOptions options={shown.options} correctSlug={null} chosenSlug={null} lang="ja" faceLang="ja" onChoose={() => {}} />
      </>,
    );

    expectOnlyCjkRuns("the study options", "ja");
    expectRunsInclude("the study options", ["買う", "売る", "借りる", "書く"]);
  });

  test("the interface around a word keeps the interface font", () => {
    render(<WordDetailsModal word={ja.word} termLang="ja" meaningLang="en" onClose={() => {}} />);

    expect(screen.getByRole("button", { name: "Close" }).querySelector(`.${WORD_FONT_CLASS}`)).toBeNull();
    expect(screen.getByText("Notes").closest(`.${WORD_FONT_CLASS}`)).toBeNull();
  });
});

describe("a Chinese word with Handwriting chosen", () => {
  test("学习 takes the face, its pinyin xuéxí keeps the app font", () => {
    const zh = PAIRS[1] as Pair;

    render(<WordHero word={zh.word} termLang="zh-Hans" meaningLang="en" />);

    expectRunsInclude("the word page", ["学习"]);
    expectNoRunWith("the word page", "xuéxí");
  });
});

describe("the stylesheet", () => {
  test("every style reaches a word font run tagged with each CJK language", async () => {
    const css = (await Bun.file(new URL("../styles/globals.css", import.meta.url)).text()).replace(/\s+/g, " ");

    for (const style of ["sans", "serif", "rounded", "handwriting"]) {
      for (const lang of ["ja", "zh-Hans", "zh-Hant", "ko"]) {
        const own = new RegExp(`data-word-font="${style}"\\] \\.word-font:lang\\(${lang}\\)`);

        expect({ style, lang, reached: own.test(css) }).toEqual({ style, lang, reached: true });
      }
    }
  });
});
