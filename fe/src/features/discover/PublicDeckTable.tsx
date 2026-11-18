import type { PublicDeck } from "@voca/contract";

export function PublicDeckTable(_props: {
  decks: readonly PublicDeck[];
  forking: string | null;
  onFork: (deck: PublicDeck) => void;
}) {
  return <p>not implemented: UI-X</p>;
}
