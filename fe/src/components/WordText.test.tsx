import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { WORD_FONT_CLASS } from "../lib/wordFont";
import { WordText } from "./WordText";

const runsOf = (container: HTMLElement) =>
  [...container.querySelectorAll(`.${WORD_FONT_CLASS}`)].map((run) => [run.textContent, run.getAttribute("lang")]);

describe("WordText", () => {
  test("each CJK run takes the face language, the Latin between them keeps the app font", () => {
    const { container } = render(<WordText text="セールでTシャツを3枚" faceLang="ja" />);

    expect(runsOf(container)).toEqual([
      ["セールで", "ja"],
      ["シャツを", "ja"],
      ["枚", "ja"],
    ]);
    expect(container.textContent).toBe("セールでTシャツを3枚");
  });

  test("a text with no CJK character renders no run", () => {
    const { container } = render(<WordText text="xuéxí" faceLang="zh-Hans" />);

    expect(runsOf(container)).toEqual([]);
    expect(container.textContent).toBe("xuéxí");
  });

  test("without a face language the text stays plain, CJK or not", () => {
    const { container } = render(<WordText text="学習" faceLang={undefined} />);

    expect(runsOf(container)).toEqual([]);
    expect(container.textContent).toBe("学習");
  });

  test("an empty text renders nothing", () => {
    const { container } = render(<WordText text="" faceLang="ja" />);

    expect(runsOf(container)).toEqual([]);
    expect(container.textContent).toBe("");
  });
});
