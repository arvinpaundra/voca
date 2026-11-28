import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import type { Drill, Question } from "@voca/contract";
import { QuestionPrompt } from "./QuestionPrompt";
import { Verdict } from "./Verdict";

// No reading hints: the prompt never shows the word's reading as ruby, even when an older server still sends it.
// The reading appears only as the prompt of reading_term, and in the verdict once the question is answered.

const question = (drill: Drill, text: string, ruby: string | null = null): Question =>
  ({
    position: 1,
    attempt: 1,
    wordSlug: "4HNCR8WYK2JD",
    drill,
    drillLabel: { term_meaning: "Word → Meaning", meaning_term: "Meaning → Word", term_reading: "Word → Kana", reading_term: "Kana → Word" }[drill],
    prompt: { text, ruby },
    options: [
      { wordSlug: "4HNCR8WYK2JD", text: "to eat" },
      { wordSlug: "4HNCR8WYK2JE", text: "to drink" },
      { wordSlug: "4HNCR8WYK2JF", text: "to see" },
      { wordSlug: "4HNCR8WYK2JG", text: "to sleep" },
    ],
  }) as unknown as Question;

describe("QuestionPrompt", () => {
  test("term_meaning: the term alone, with no ruby even when the payload has one", () => {
    const { container } = render(<QuestionPrompt question={question("term_meaning", "食べる", "たべる")} termLang="ja" />);

    const term = screen.getByText("食べる");
    expect(term.classList.contains("term")).toBe(true);
    expect(term.getAttribute("lang")).toBe("ja");
    expect(container.querySelector("ruby, rt")).toBeNull();
    expect(container.textContent).not.toContain("たべる");
  });

  test("meaning_term: the meaning, with no language and no reading", () => {
    const { container } = render(<QuestionPrompt question={question("meaning_term", "to eat", "たべる")} termLang="ja" />);

    const prompt = screen.getByText("to eat");
    expect(prompt.classList.contains("term")).toBe(true);
    expect(prompt.getAttribute("lang")).toBeNull();
    expect(prompt.getAttribute("dir")).toBe("auto");
    expect(container.querySelector("ruby, rt")).toBeNull();
    expect(container.textContent).not.toContain("たべる");
  });

  test("term_reading: the term, without the reading it asks for", () => {
    const { container } = render(<QuestionPrompt question={question("term_reading", "食べる")} termLang="ja" />);

    expect(screen.getByText("食べる").getAttribute("lang")).toBe("ja");
    expect(container.querySelector("ruby, rt")).toBeNull();
  });

  test("reading_term: the reading is the prompt, in its own script", () => {
    render(<QuestionPrompt question={question("reading_term", "xuéxí")} termLang="zh-Hans" />);

    expect(screen.getByText("xuéxí").getAttribute("lang")).toBe("zh-Latn-pinyin");
  });

  test("the direction label sits above the prompt", () => {
    const { container } = render(<QuestionPrompt question={question("term_reading", "食べる")} termLang="ja" />);

    const label = container.querySelector(".drill");
    expect(label?.textContent).toBe("Word → Kana");
    expect(label?.getAttribute("dir")).toBe("auto");
  });
});

describe("Verdict", () => {
  test.each([true, false])("answered (correct: %p): the word's reading is shown, in its own script", (correct) => {
    const { container } = render(
      <Verdict correct={correct} term="学习" answer="to study" reading="xuéxí" readingLang="zh-Latn-pinyin" onNext={() => {}} />,
    );

    const reading = container.querySelector(".verdict .reading");
    expect(reading?.textContent).toBe("xuéxí");
    expect(reading?.getAttribute("lang")).toBe("zh-Latn-pinyin");
    expect(screen.getByRole("status").textContent).toContain("学习 means “to study”.");
  });

  test("a word without a reading shows none", () => {
    const { container } = render(<Verdict correct term="hola" answer="hello" reading={null} onNext={() => {}} />);

    expect(container.querySelector(".verdict .reading")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("hola means “hello”.");
  });
});
