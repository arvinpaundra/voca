import { describe, expect, test } from "bun:test";
import { estimateText, nextReviewLabel } from "./queueSummary";

describe("estimateText edges", () => {
  test("a queue that is already clear reads as under a minute, not zero minutes", () => {
    expect(estimateText(0)).toBe("Under a minute");
  });
});

describe("nextReviewLabel", () => {
  test("a forecast day reads as weekday, day and month", () => {
    expect(nextReviewLabel("2026-11-19")).toBe("Thu 19 Nov");
  });
});
