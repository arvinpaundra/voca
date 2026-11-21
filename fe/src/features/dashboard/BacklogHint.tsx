import type { DeckSummary, SessionSize } from "@voca/contract";
import { backlogDecks } from "./backlog";

// One hint above Today that names every deck with a big backlog; nothing when no deck has one.
export function BacklogHint({ decks, sessionSize }: { decks: readonly DeckSummary[]; sessionSize: SessionSize }) {
  const behind = backlogDecks(decks, sessionSize);

  if (behind.length === 0) return null;

  const sentences = behind.map((deck) => `${deck.title} has ${deck.dueCount} words due.`);

  return (
    <p role="note" className="alert alert-info">
      <span>{sentences.join(" ")}</span>
      <span>You can snooze a deck from its page.</span>
    </p>
  );
}
