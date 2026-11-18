import type { Drill, HardWord } from "@voca/contract";

export type HardDrill = { readonly drill: Drill; readonly label: string; readonly count: number };

/** The drills that have hard cards, with how many, in the contract's drill order. */
export const hardDrills = (_words: readonly HardWord[]): HardDrill[] => {
  throw new Error("not implemented: F-H");
};
