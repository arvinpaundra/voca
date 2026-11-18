import type { Deck, WordWithCards } from "@voca/contract";

export function WordTable(_props: {
  deck: Deck;
  words: readonly WordWithCards[];
  onEdit: (word: WordWithCards) => void;
  onDelete: (word: WordWithCards) => void;
}) {
  return <p>not implemented: UI-L</p>;
}
