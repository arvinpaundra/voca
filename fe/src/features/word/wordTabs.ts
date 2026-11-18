import type { DeckDrill, Drill, WordDrillStats } from "@voca/contract";
import type { Tab } from "../../components/Tabs";

/** One tab per drill of the deck, in the deck's order; a drill the word has no Card in is counted "new". */
export const wordTabs = (drills: readonly DeckDrill[], stats: readonly WordDrillStats[]): Array<Tab<Drill>> =>
  drills.map((drill) => {
    const studied = stats.some((entry) => entry.drill === drill.drill);

    return studied
      ? { value: drill.drill, label: drill.label }
      : { value: drill.drill, label: drill.label, count: "new" };
  });
