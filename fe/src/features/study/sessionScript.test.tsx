import { expect, test } from "bun:test";
import type { Drill } from "@voca/contract";
import { answerLang, promptLang } from "./scriptLang";
import { rememberRequestedSize, requestedSize, shortSessionNotice } from "./shortSession";

// A reading is written in its own script: pinyin and jyutping are Latin, hiragana is Japanese.
// A session holds the words it found, which can be fewer than the Learner asked for (FR-11).

const storage = (): Storage => {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    clear: () => values.clear(),
    key: () => null,
    get length() {
      return values.size;
    },
  } as Storage;
};

test.each([
  ["term_meaning", "ja", "ja"],
  ["term_reading", "ja", "ja"],
  ["reading_term", "ja", "ja"],
  ["reading_term", "zh-Hans", "zh-Latn-pinyin"],
  ["reading_term", "yue", "yue-Latn-jyutping"],
  ["term_reading", "zh-Hans", "zh-Hans"],
] as const)("the %s prompt of a %s deck is tagged %s", (drill: Drill, termLang, lang) => {
  expect(promptLang(drill, termLang)).toBe(lang);
});

test.each([
  ["term_meaning", "ja"],
  ["term_meaning", "zh-Hans"],
] as const)("a meaning prompt carries no language (%s, %s)", (drill: Drill, termLang) => {
  expect(promptLang(drill, termLang)).toBeUndefined();
});

test.each([
  ["meaning_term", "ja", "ja"],
  ["reading_term", "zh-Hans", "zh-Hans"],
  ["term_reading", "zh-Hans", "zh-Latn-pinyin"],
  ["term_reading", "yue", "yue-Latn-jyutping"],
  ["term_reading", "ja", "ja"],
] as const)("the options of %s in a %s deck are tagged %s", (drill: Drill, termLang, lang) => {
  expect(answerLang(drill, termLang)).toBe(lang);
});

test("meaning options carry no language", () => {
  expect(answerLang("term_meaning", "ja")).toBeUndefined();
});

test("the requested size survives the move from setup to the session screen", () => {
  const store = storage();

  rememberRequestedSize(store, 15);

  expect(requestedSize(store)).toBe(15);
});

test("an empty or unreadable store means no request is known", () => {
  expect(requestedSize(storage())).toBeNull();
});

test.each([
  [7, 3, "Only 3 of the 7 words you asked for were available today."],
  [20, 1, "Only 1 of the 20 words you asked for were available today."],
])("a session of %p that found %p says so", (requested, size, notice) => {
  expect(shortSessionNotice(requested, size)).toBe(notice);
});

test.each([
  [7, 7],
  [null, 3],
])("a full session, or one whose request is unknown, says nothing (%p, %p)", (requested, size) => {
  expect(shortSessionNotice(requested, size)).toBeNull();
});
