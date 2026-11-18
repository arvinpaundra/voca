import type { DeckSummary } from "@voca/contract";

export function DeckRows(_props: {
  decks: readonly DeckSummary[];
  onEdit: (deck: DeckSummary) => void;
  onDelete: (deck: DeckSummary) => void;
}) {
  return <p>not implemented: UI-L2</p>;
}
