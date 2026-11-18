import type { DeckDrill, Drill, WordDrillStats } from "@voca/contract";
import type { Tab } from "../../components/Tabs";

/** One tab per drill of the deck, in the deck's order; a drill the word has no Card in is counted "new". */
export const wordTabs = (_drills: readonly DeckDrill[], _stats: readonly WordDrillStats[]): Array<Tab<Drill>> => {
  throw new Error("not implemented: F-W");
};
