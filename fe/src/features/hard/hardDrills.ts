import { Drill, drillLabel, type HardWord } from "@voca/contract";

export type HardDrill = { readonly drill: Drill; readonly label: string; readonly count: number };

// A word without a deck (the API only omits it while rolling out) still needs a language for its label.
const FALLBACK_LANG = "en";

export const termLangOf = (word: HardWord): string => word.deck?.termLang ?? FALLBACK_LANG;

/** The drills that have hard cards, with how many, in the contract's drill order. */
export const hardDrills = (words: readonly HardWord[]): HardDrill[] =>
  Drill.literals.flatMap((drill) => {
    const matching = words.filter((word) => word.cards.some((card) => card.isHard && card.drill === drill));
    const first = matching[0];

    if (first === undefined) return [];

    return [{ drill, label: drillLabel(termLangOf(first), drill), count: matching.length }];
  });
