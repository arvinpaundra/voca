import { describe, expect, test } from "bun:test";
import type { Word } from "@voca/contract";
import { back, currentCard, flip, startRun, summary, swipe, type Run } from "./flashcardsModel";

// One pass: each card is shown once, a swipe moves on, Back undoes the last swipe, and the summary counts the swipes.

const word = (n: number) =>
  ({
    slug: `WRD00000000${n}`,
    term: `語${n}`,
    reading: `ご${n}`,
    meaning: `meaning ${n}`,
    example: null,
    notes: null,
    createdAt: "2026-11-01T00:00:00.000Z",
  }) as unknown as Word;

const cards = [word(1), word(2), word(3)];

const slugOf = (run: Run) => currentCard(run)?.slug ?? null;

describe("a run", () => {
  test("starts on the first card, front up, with nothing marked", () => {
    const run = startRun(cards);

    expect(slugOf(run)).toBe("WRD000000001");
    expect(run.flipped).toBe(false);
    expect(summary(run)).toEqual({ remembered: 0, notYet: 0 });
  });

  test("flip turns the card over and back", () => {
    const run = startRun(cards);

    expect(flip(run).flipped).toBe(true);
    expect(flip(flip(run)).flipped).toBe(false);
    expect(slugOf(flip(run))).toBe("WRD000000001");
  });

  test("every card is shown once, in order, and not-yet cards don't come back", () => {
    let run = startRun(cards);
    const seen: Array<string | null> = [];

    for (const mark of ["notYet", "remembered", "notYet"] as const) {
      seen.push(slugOf(run));
      run = swipe(flip(run), mark);
      expect(run.flipped).toBe(false);
    }

    expect(seen).toEqual(["WRD000000001", "WRD000000002", "WRD000000003"]);
    expect(currentCard(run)).toBeNull();
    expect(summary(run)).toEqual({ remembered: 1, notYet: 2 });
  });

  test("a swipe after the last card changes nothing", () => {
    const done = swipe(swipe(swipe(startRun(cards), "remembered"), "remembered"), "remembered");

    expect(swipe(done, "notYet")).toEqual(done);
  });

  test("k swipes, then k Backs, return to the first card with nothing counted", () => {
    let run = startRun(cards);
    run = swipe(run, "remembered");
    run = swipe(run, "notYet");
    run = swipe(run, "remembered");

    run = back(run);
    expect(slugOf(run)).toBe("WRD000000003");
    expect(summary(run)).toEqual({ remembered: 1, notYet: 1 });

    run = back(run);
    expect(slugOf(run)).toBe("WRD000000002");
    expect(summary(run)).toEqual({ remembered: 1, notYet: 0 });

    run = back(run);
    expect(slugOf(run)).toBe("WRD000000001");
    expect(run.flipped).toBe(false);
    expect(summary(run)).toEqual({ remembered: 0, notYet: 0 });
  });

  test("Back on the first card changes nothing", () => {
    const run = startRun(cards);

    expect(back(run)).toEqual(run);
  });

  test("Back shows the previous card front up", () => {
    const run = back(flip(swipe(startRun(cards), "remembered")));

    expect(slugOf(run)).toBe("WRD000000001");
    expect(run.flipped).toBe(false);
  });

  test("an empty run is over at once", () => {
    const run = startRun([]);

    expect(currentCard(run)).toBeNull();
    expect(summary(run)).toEqual({ remembered: 0, notYet: 0 });
  });
});
