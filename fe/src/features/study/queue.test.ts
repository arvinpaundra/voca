import { describe, expect, test } from "bun:test";
import type { Drill, Question } from "@voca/contract";
import { advance, rememberDrills, rememberedDrills } from "./queue";

// The client orders a session: questions in position order, a wrong word retried a few questions later.
// The drill picker remembers the last set per deck, on this device.

const question = (position: number, attempt = 1): Question =>
  ({
    position,
    attempt,
    wordSlug: `W${String(position).padStart(11, "0")}`,
    drill: "term_meaning",
    drillLabel: "Word → Meaning",
    prompt: { text: `term ${position}`, ruby: null },
    options: []
  }) as unknown as Question;

const positions = (queue: readonly Question[]) => queue.map((q) => q.position);

describe("advance", () => {
  test("a right answer drops the head", () => {
    expect(positions(advance([question(1), question(2), question(3)], null))).toEqual([2, 3]);
  });

  test("a retry comes back 3 questions later", () => {
    const queue = [1, 2, 3, 4, 5].map((p) => question(p));

    expect(positions(advance(queue, question(6, 2)))).toEqual([2, 3, 6, 4, 5]);
  });

  test.each([
    [[1], [6]],
    [[1, 2], [2, 6]],
    [[1, 2, 3], [2, 3, 6]]
  ])("with fewer questions left, a retry goes last: %p", (before, after) => {
    expect(positions(advance(before.map((p) => question(p)), question(6, 2)))).toEqual(after);
  });

  test("the input queue is left untouched", () => {
    const queue = [question(1), question(2)];

    advance(queue, question(3, 2));

    expect(positions(queue)).toEqual([1, 2]);
  });
});

const memoryStorage = (): Storage => {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value)
  };
};

const ALL: readonly Drill[] = ["term_meaning", "meaning_term", "term_reading", "reading_term"];

describe("rememberedDrills", () => {
  test("nothing remembered: the first available drill", () => {
    expect(rememberedDrills(memoryStorage(), "DECK000001", ["meaning_term", "term_reading"])).toEqual(["meaning_term"]);
  });

  test("the last set started on that deck, under voca.drills.<deckSlug>", () => {
    const storage = memoryStorage();

    rememberDrills(storage, "DECK000001", ["term_meaning", "reading_term"]);

    expect(storage.getItem("voca.drills.DECK000001")).not.toBeNull();
    expect(rememberedDrills(storage, "DECK000001", ALL)).toEqual(["term_meaning", "reading_term"]);
    expect(rememberedDrills(storage, "DECK000002", ALL)).toEqual(["term_meaning"]);
  });

  test("drills no longer available are dropped; if none is left, the default", () => {
    const storage = memoryStorage();

    rememberDrills(storage, "DECK000001", ["term_meaning", "reading_term"]);

    expect(rememberedDrills(storage, "DECK000001", ["term_meaning", "meaning_term"])).toEqual(["term_meaning"]);
    expect(rememberedDrills(storage, "DECK000001", ["meaning_term"])).toEqual(["meaning_term"]);
  });

  test("a corrupt value falls back to the default", () => {
    const storage = memoryStorage();

    storage.setItem("voca.drills.DECK000001", "{not json");

    expect(rememberedDrills(storage, "DECK000001", ALL)).toEqual(["term_meaning"]);
  });
});
