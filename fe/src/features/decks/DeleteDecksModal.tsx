import { useState } from "react";
import { Result } from "effect";
import type { DeckSlug } from "@voca/contract";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { session } from "../../lib/appSession";

type DeleteDecksModalProps = {
  // The selection awaiting confirmation; null closes the dialog.
  deckSlugs: readonly [DeckSlug, ...DeckSlug[]] | null;
  onClose: () => void;
  // Called once the request answered, with how many decks could not be deleted.
  onDeleted: (failed: number) => void;
};

export function DeleteDecksModal({ deckSlugs, onClose, onDeleted }: DeleteDecksModalProps) {
  // Mounts only while a selection awaits confirmation, so every confirmation starts with no error.
  if (deckSlugs === null) return null;

  return <DeleteDecksDialog deckSlugs={deckSlugs} onClose={onClose} onDeleted={onDeleted} />;
}

type DeleteDecksDialogProps = {
  deckSlugs: readonly [DeckSlug, ...DeckSlug[]];
  onClose: () => void;
  onDeleted: (failed: number) => void;
};

function DeleteDecksDialog({ deckSlugs, onClose, onDeleted }: DeleteDecksDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = deckSlugs.length;
  const label = count === 1 ? "1 deck" : `${count} decks`;

  const confirm = async () => {
    setBusy(true);
    setError(null);

    const result = await session.call((client) => client.library.deleteDecks({ payload: { deckSlugs } }));

    setBusy(false);
    if (Result.isSuccess(result)) {
      onDeleted(result.success.failed.length);
      return;
    }

    setError("Could not delete the decks. Try again.");
  };

  return (
    <Modal
      open
      title={`Delete ${label}?`}
      description="All cards in these decks will be removed. This cannot be undone."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" busy={busy} onClick={() => void confirm()}>
            {`Delete ${label}`}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        {error !== null && (
          <p role="alert" className="err">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
