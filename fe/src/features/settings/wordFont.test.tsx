import { beforeEach, describe, expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WORD_FONT_CLASS } from "../../lib/wordFont";
import { WordFontSection } from "./WordFontSection";

// The Display section of the settings: the word font picker. The choice stays on this device, so it applies on
// change with no Save, and the picker itself keeps the interface's font.

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.wordFont;
});

const section = () => screen.getByRole("region", { name: "Display" });

describe("WordFontSection", () => {
  test("a Word font select offering the five styles, System default chosen on a fresh browser", () => {
    render(<WordFontSection />);

    const select = within(section()).getByLabelText("Word font") as HTMLSelectElement;
    const labels = [...select.options].map((option) => option.textContent);

    expect(labels).toEqual(["System default", "Sans", "Serif", "Rounded", "Handwriting"]);
    expect(select.value).toBe("system");
  });

  test("choosing Handwriting applies and keeps it at once, with no Save", async () => {
    const user = userEvent.setup();
    render(<WordFontSection />);

    await user.selectOptions(within(section()).getByLabelText("Word font"), "Handwriting");

    expect(document.documentElement.dataset.wordFont).toBe("handwriting");
    expect(window.localStorage.getItem("voca.wordFont")).toBe("handwriting");
    expect(within(section()).queryByRole("button", { name: "Save" })).toBeNull();
  });

  test("shows the stored choice after a reload", () => {
    window.localStorage.setItem("voca.wordFont", "serif");

    render(<WordFontSection />);

    expect((within(section()).getByLabelText("Word font") as HTMLSelectElement).value).toBe("serif");
  });

  test("the help says what the word font changes, word for word", () => {
    render(<WordFontSection />);

    const help = "Changes only kanji, kana, hanzi and hangul in your words. Latin letters (including pinyin), numbers and punctuation keep the app font.";

    if (within(section()).queryByText(help) === null) throw new Error("not implemented: WF: the Word font row does not show the new help");
  });

  test("a preview that mixes scripts: only its CJK characters take the word font, in ja", () => {
    render(<WordFontSection />);

    const preview = [...section().querySelectorAll("*")].find((element) => element.textContent === "勉強 · Tシャツを3枚 · belajar");

    if (preview === undefined) throw new Error("not implemented: WF: the preview does not read 勉強 · Tシャツを3枚 · belajar");

    const runs = [...preview.querySelectorAll(`.${WORD_FONT_CLASS}`)];

    expect(runs.map((run) => [run.textContent, run.getAttribute("lang")])).toEqual([
      ["勉強", "ja"],
      ["シャツを", "ja"],
      ["枚", "ja"],
    ]);
    expect(preview.closest(`.${WORD_FONT_CLASS}`)).toBeNull();
  });

  test("the picker keeps the interface's font", () => {
    render(<WordFontSection />);

    expect(within(section()).getByLabelText("Word font").closest(`.${WORD_FONT_CLASS}`)).toBeNull();
    expect(within(section()).getByRole("heading", { name: "Display" }).closest(`.${WORD_FONT_CLASS}`)).toBeNull();
  });
});
