import type { DateTime } from "effect";
import type { WordDrillStats } from "@voca/contract";

// One drill of the word page: status and hard toggle, memory, effort, confused with, history.
export function DrillPanel(_props: {
  stats: WordDrillStats;
  timezone: string;
  now: DateTime.Utc;
  busy?: boolean;
  onToggleHard: (hard: boolean) => void;
}) {
  return <p>not implemented: F-W</p>;
}
