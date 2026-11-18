import type { DeckDetail, DeckStats } from "@voca/contract";
import type { Tab } from "../../components/Tabs";
import type { WordFilter } from "./wordFilter";

/** The deck page's filter tabs and search placeholder: words from the deck's word count, the rest from its stats. */
export const deckCounts = (
  _deck: DeckDetail,
  _stats: DeckStats | null,
): { readonly tabs: Array<Tab<WordFilter>>; readonly searchPlaceholder: string } => {
  throw new Error("not implemented: F-W");
};
