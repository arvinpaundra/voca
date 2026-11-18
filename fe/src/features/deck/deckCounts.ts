import type { DeckDetail, DeckStats } from "@voca/contract";
import type { Tab } from "../../components/Tabs";
import type { WordFilter } from "./wordFilter";

/** The deck page's filter tabs and search placeholder: words from the deck's word count, the rest from its stats. */
export const deckCounts = (
  deck: DeckDetail,
  stats: DeckStats | null,
): { readonly tabs: Array<Tab<WordFilter>>; readonly searchPlaceholder: string } => ({
  tabs: [
    { value: "all", label: "All", count: deck.wordCount },
    { value: "due", label: "Due", count: deck.dueCount ?? stats?.dueToday },
    { value: "new", label: "New", count: stats?.maturity.new },
    { value: "hard", label: "Hard" },
    { value: "mature", label: "Mature", count: stats?.maturity.mature },
  ],
  searchPlaceholder: deck.wordCount === undefined ? "Search words" : `Search ${deck.wordCount} words`,
});
