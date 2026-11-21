import type { Word } from "@voca/contract";

export type Mark = "remembered" | "notYet";

/** One pass through the cards: the card at `index` is showing, and `marks` holds one swipe per card before it. */
export interface Run {
  readonly cards: ReadonlyArray<Word>;
  readonly index: number;
  readonly flipped: boolean;
  readonly marks: ReadonlyArray<Mark>;
}

export const startRun = (cards: ReadonlyArray<Word>): Run => ({
  cards,
  index: 0,
  flipped: false,
  marks: [],
});

/** Turns the showing card over, or back. */
export const flip = (run: Run): Run => {
  if (currentCard(run) === null) return run;

  return { ...run, flipped: !run.flipped };
};

/** Marks the showing card and moves to the next one, front up. Does nothing once the run is over. */
export const swipe = (run: Run, mark: Mark): Run => {
  if (currentCard(run) === null) return run;

  return {
    ...run,
    index: run.index + 1,
    flipped: false,
    marks: [...run.marks, mark],
  };
};

/** Returns to the previous card, front up, and undoes its swipe. Does nothing on the first card. */
export const back = (run: Run): Run => {
  if (run.index === 0) return run;

  return {
    ...run,
    index: run.index - 1,
    flipped: false,
    marks: run.marks.slice(0, -1),
  };
};

/** The card showing, or null once every card has been swiped. */
export const currentCard = (run: Run): Word | null => run.cards[run.index] ?? null;

export const summary = (run: Run): { readonly remembered: number; readonly notYet: number } => {
  const remembered = run.marks.filter((mark) => mark === "remembered").length;

  return { remembered, notYet: run.marks.length - remembered };
};
