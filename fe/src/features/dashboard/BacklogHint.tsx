import type { DeckSummary, SessionSize } from "@voca/contract";

// One hint above Today that names every deck with a big backlog; nothing when no deck has one.
export function BacklogHint(_props: { decks: readonly DeckSummary[]; sessionSize: SessionSize }) {
  return <p>not implemented: BH</p>;
}
