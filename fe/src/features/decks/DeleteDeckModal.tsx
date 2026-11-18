import { useState } from "react";
import { Result } from "effect";
import type { Deck } from "@voca/contract";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { session } from "../../lib/appSession";

type DeleteDeckModalProps = {
  // The deck awaiting confirmation; unset closes the dialog.
  deck: Pick<Deck, "slug" | "title"> | null;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteDeckModal({ deck, onClose, onDeleted }: DeleteDeckModalProps) {
  // Mounts only while a deck awaits confirmation, so every confirmation starts with no error.
  if (deck === null) return null;

  return <DeleteDeckDialog deck={deck} onClose={onClose} onDeleted={onDeleted} />;
}

type DeleteDeckDialogProps = {
  deck: Pick<Deck, "slug" | "title">;
  onClose: () => void;
  onDeleted: () => void;
};

function DeleteDeckDialog({ deck, onClose, onDeleted }: DeleteDeckDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);

    const result = await session.call((client) => client.library.deleteDeck({ params: { deckSlug: deck.slug } }));

    setBusy(false);
    if (Result.isSuccess(result)) {
      onDeleted();
      return;
    }

    setError("Could not delete the deck. Try again.");
  };

  return (
    <Modal
      open
      title="Delete deck?"
      description="All cards in this deck will be removed. This cannot be undone."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" busy={busy} onClick={() => void confirm()}>
            Delete deck
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
