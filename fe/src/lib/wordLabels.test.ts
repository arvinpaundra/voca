import { expect, test } from "bun:test"
import { wordLabels } from "./wordLabels.ts"

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
