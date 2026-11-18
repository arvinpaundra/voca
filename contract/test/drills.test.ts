import { expect, test } from "bun:test"
import { drillLabel, readingLang, wordLabels } from "../src/drills.ts"

// The Language Profile: field labels follow the primary subtag of the deck's term language. Data, not logic.

test.each([
  ["ja", { term: "Word", reading: "Hiragana" }],
  ["ja-JP", { term: "Word", reading: "Hiragana" }],
  ["zh", { term: "Hanzi", reading: "Pinyin" }],
  ["zh-Hans", { term: "Hanzi", reading: "Pinyin" }],
  ["ZH-hant", { term: "Hanzi", reading: "Pinyin" }],
  ["yue", { term: "Hanzi", reading: "Jyutping" }],
  ["en", { term: "Word", reading: "Reading" }],
  ["ko", { term: "Word", reading: "Reading" }]
])("%s", (termLang, labels) => {
  expect(wordLabels(termLang)).toEqual(labels)
})

test.each([
  ["ja", "ja"],
  ["ja-JP", "ja-JP"],
  ["zh", "zh-Latn-pinyin"],
  ["zh-Hans", "zh-Latn-pinyin"],
  ["yue", "yue-Latn-jyutping"],
  ["en", "en"]
])("a reading in a %s deck is tagged %s", (termLang, lang) => {
  expect(readingLang(termLang)).toBe(lang)
})

test.each([
  ["ja", "term_meaning", "Word → Meaning"],
  ["ja", "meaning_term", "Meaning → Word"],
  ["ja", "term_reading", "Word → Hiragana"],
  ["zh-Hans", "reading_term", "Pinyin → Hanzi"],
  ["en", "term_reading", "Word → Reading"]
] as const)("%s %s is labelled %s", (termLang, drill, label) => {
  expect(drillLabel(termLang, drill)).toBe(label)
})
