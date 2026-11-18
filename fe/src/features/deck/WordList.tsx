import type { DateTime } from "effect";
import type { Deck, WordWithCards } from "@voca/contract";

export function WordList(_props: {
  deck: Deck;
  words: readonly WordWithCards[];
  now: DateTime.Utc;
  onEdit: (word: WordWithCards) => void;
  onDelete: (word: WordWithCards) => void;
}) {
  return <p>not implemented: UI-L2</p>;
}
