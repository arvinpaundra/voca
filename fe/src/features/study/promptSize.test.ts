import { expect, test } from "bun:test";
import { promptSize } from "./promptSize";

test.each([
  ["食べる", "short"],
  ["eat", "short"],
  ["abcdef", "short"],
  ["𠮷野家𠮷野家", "short"],
  ["お疲れ様でした", "medium"],
  ["to forget", "medium"],
  ["abcdefghijklmn", "medium"],
  ["abcdefghijklmno", "long"],
  ["to be absent-minded, to be careless", "long"],
  ["to do something carelessly and then regret it a moment later", "long"],
] as const)("%s is %s", (text, size) => {
  expect(promptSize(text)).toBe(size);
});

test("spaces count as characters", () => {
  expect(promptSize("a b c d")).toBe("medium");
});
