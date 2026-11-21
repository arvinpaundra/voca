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

  test("a preview in the word font; the picker keeps the interface's font", () => {
    render(<WordFontSection />);

    const preview = section().querySelector(`.${WORD_FONT_CLASS}`);

    expect(preview?.textContent).toContain("勉強");
    expect(preview?.textContent).toContain("belajar");
    expect(within(section()).getByLabelText("Word font").closest(`.${WORD_FONT_CLASS}`)).toBeNull();
    expect(within(section()).getByRole("heading", { name: "Display" }).closest(`.${WORD_FONT_CLASS}`)).toBeNull();
  });
});
