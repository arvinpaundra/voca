import type { Drill } from "@voca/contract";

/** A word answered in this tab's session: its first attempt, and whether it is (or should be) hard. */
export type SessionWordItem = {
  readonly wordSlug: string;
  readonly drill: Drill;
  readonly term: string;
  readonly meaning: string;
  readonly lang: string;
  readonly correct: boolean;
  readonly leech: boolean;
  readonly hard: boolean;
};

export function SessionWords(_props: {
  items: readonly SessionWordItem[];
  drillLabel: string;
  onToggleHard: (item: SessionWordItem) => void;
}) {
  return <p>not implemented: F-H</p>;
}
