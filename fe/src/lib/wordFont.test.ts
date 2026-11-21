import { beforeEach, describe, expect, test } from "bun:test";
import { WORD_FONTS, WORD_FONT_KEY, applyWordFont, setWordFont, wordFont } from "./wordFont";

// The word font is a per-device choice: kept in localStorage and shown on <html data-word-font>, which the
// stylesheet reads. Only word content follows it; the interface keeps its own fonts.

const root = () => document.documentElement;

beforeEach(() => {
  window.localStorage.clear();
  delete root().dataset.wordFont;
});

describe("the word font choice", () => {
  test("offers the five styles, System default first", () => {
    expect(WORD_FONTS).toEqual(["system", "sans", "serif", "rounded", "handwriting"]);
  });

  test("a fresh browser uses System default", () => {
    expect(wordFont()).toBe("system");
  });

  test("an unknown stored value falls back to System default", () => {
    window.localStorage.setItem(WORD_FONT_KEY, "comic-sans");

    expect(wordFont()).toBe("system");
  });

  test("a choice is stored under voca.wordFont and applied at once", () => {
    setWordFont("handwriting");

    expect(WORD_FONT_KEY).toBe("voca.wordFont");
    expect(window.localStorage.getItem("voca.wordFont")).toBe("handwriting");
    expect(wordFont()).toBe("handwriting");
    expect(root().dataset.wordFont).toBe("handwriting");
  });

  test("after a reload the stored choice is applied again", () => {
    window.localStorage.setItem(WORD_FONT_KEY, "serif");

    applyWordFont();

    expect(root().dataset.wordFont).toBe("serif");
  });

  test("a fresh browser applies System default", () => {
    applyWordFont();

    expect(root().dataset.wordFont).toBe("system");
  });
});
