import { describe, expect, test } from "bun:test";
import { languageOptions, pickerValue } from "./languages";

// A deck's languages are picked from a list instead of typed as BCP-47 by hand, with an escape for the rest.

const tags = () => languageOptions().map((option) => option.value);

describe("the language options", () => {
  test("cover the languages the drills have labels for, plus common ones", () => {
    expect(tags()).toContain("ja");
    expect(tags()).toContain("zh-Hans");
    expect(tags()).toContain("zh-Hant");
    expect(tags()).toContain("yue");
    expect(tags()).toContain("ko");
    expect(tags()).toContain("en");
    expect(tags()).toContain("id");
    expect(tags()).toContain("ar");
  });

  test("every option has a readable label and a tag of its own", () => {
    expect(languageOptions().length).toBeGreaterThanOrEqual(8);
    expect(new Set(tags()).size).toBe(languageOptions().length);
    expect(languageOptions().every((option) => option.label.trim().length > 1)).toBe(true);
    expect(tags()).not.toContain("other");
  });

  test("Japanese reads as Japanese, not as a tag", () => {
    expect(languageOptions().find((option) => option.value === "ja")?.label).toBe("Japanese");
  });
});

describe("pickerValue", () => {
  test("an offered language selects itself", () => {
    expect(pickerValue("ja")).toBe("ja");
    expect(pickerValue("zh-Hans")).toBe("zh-Hans");
  });

  test("anything else falls back to the other escape, so the typed tag stays editable", () => {
    expect(pickerValue("fi")).toBe("other");
    expect(pickerValue("")).toBe("other");
  });
});
