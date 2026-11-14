import { describe, expect, test } from "bun:test";
import { segments, tally } from "./progress";

// Only a word's first attempt is rated, so progress and the tally count first attempts; retries don't add segments.

describe("segments", () => {
  test("first attempts in order, then pending", () => {
    expect(segments(5, [true, false])).toEqual(["right", "wrong", "pending", "pending", "pending"]);
  });

  test("an unstarted and a finished session", () => {
    expect(segments(3, [])).toEqual(["pending", "pending", "pending"]);
    expect(segments(2, [false, true])).toEqual(["wrong", "right"]);
  });

  test("never longer than the session", () => {
    expect(segments(2, [true, true, true])).toEqual(["right", "right"]);
  });
});

describe("tally", () => {
  test("counts and the share right", () => {
    expect(tally([true, false, true, true])).toEqual({ right: 3, wrong: 1, accuracy: 0.75 });
  });

  test("no answers yet: no accuracy", () => {
    expect(tally([])).toEqual({ right: 0, wrong: 0, accuracy: null });
  });
});
