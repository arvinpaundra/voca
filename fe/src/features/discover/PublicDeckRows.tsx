import type { PublicDeck } from "@voca/contract";

export function PublicDeckRows(_props: {
  decks: readonly PublicDeck[];
  forking: string | null;
  onFork: (deck: PublicDeck) => void;
}) {
  return <p>not implemented: UI-X2</p>;
}
