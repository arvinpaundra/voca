import type { DeckSlug } from "@voca/contract";

type DeleteDecksModalProps = {
  // The selection awaiting confirmation; null closes the dialog.
  deckSlugs: readonly [DeckSlug, ...DeckSlug[]] | null;
  onClose: () => void;
  // Called once the request answered, with how many decks could not be deleted.
  onDeleted: (failed: number) => void;
};

export function DeleteDecksModal({ deckSlugs }: DeleteDecksModalProps) {
  if (deckSlugs === null) return null;

  return <p>not implemented: LD</p>;
}
