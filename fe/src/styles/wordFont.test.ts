import { expect, test } from "bun:test";

// The chosen word font reaches only CJK word content: every rule keyed on <html data-word-font> must be scoped to a
// CJK language. Anything else (en, id, right-to-left scripts, pinyin and jyutping readings, untagged meanings)
// keeps the app font.

const CJK = ["ja", "zh-Hans", "zh-Hant", "ko"];

const css = await Bun.file(new URL("./globals.css", import.meta.url)).text();

// The selectors of every rule, one per comma-separated entry, with comments removed.
const selectors = css
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("{")
  .slice(0, -1)
  .map((chunk) => chunk.slice(chunk.lastIndexOf("}") + 1))
  .flatMap((list) => list.split(","))
  .map((selector) => selector.trim());

const wordFontSelectors = selectors.filter((selector) => selector.includes("data-word-font"));

const cjkOnly = (selector: string) => {
  const langs = [...selector.matchAll(/:lang\(([^)]+)\)/g)].map((match) => match[1]?.trim());

  return langs.length > 0 && langs.every((lang) => lang !== undefined && CJK.includes(lang));
};

test("every style has CJK rules", () => {
  for (const style of ["sans", "serif", "rounded", "handwriting"]) {
    expect(wordFontSelectors.some((selector) => selector.includes(`"${style}"`) && cjkOnly(selector))).toBe(true);
  }
});

test("no word font rule reaches content outside ja, zh-Hans, zh-Hant and ko", () => {
  const outside = wordFontSelectors.filter((selector) => !cjkOnly(selector));

  if (outside.length > 0) throw new Error(`not implemented: WC: these rules apply the word font outside CJK:\n${outside.join("\n")}`);
});
