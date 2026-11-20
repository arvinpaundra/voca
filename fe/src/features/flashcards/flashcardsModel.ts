import type { Word } from "@voca/contract";

export type Mark = "remembered" | "notYet";

/** One pass through the cards: the card at `index` is showing, and `marks` holds one swipe per card before it. */
export interface Run {
  readonly cards: ReadonlyArray<Word>;
  readonly index: number;
  readonly flipped: boolean;
  readonly marks: ReadonlyArray<Mark>;
}

export const startRun = (_cards: ReadonlyArray<Word>): Run => {
  throw new Error("not implemented: FF");
};

/** Turns the showing card over, or back. */
export const flip = (_run: Run): Run => {
  throw new Error("not implemented: FF");
};

/** Marks the showing card and moves to the next one, front up. Does nothing once the run is over. */
export const swipe = (_run: Run, _mark: Mark): Run => {
  throw new Error("not implemented: FF");
};

/** Returns to the previous card, front up, and undoes its swipe. Does nothing on the first card. */
export const back = (_run: Run): Run => {
  throw new Error("not implemented: FF");
};

/** The card showing, or null once every card has been swiped. */
export const currentCard = (_run: Run): Word | null => {
  throw new Error("not implemented: FF");
};

export const summary = (_run: Run): { readonly remembered: number; readonly notYet: number } => {
  throw new Error("not implemented: FF");
};
