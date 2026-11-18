import type { DeckSummary } from "@voca/contract";

export function DeckTable(_props: {
  decks: readonly DeckSummary[];
  onEdit: (deck: DeckSummary) => void;
  onDelete: (deck: DeckSummary) => void;
}) {
  return <p>not implemented: UI-L</p>;
}
