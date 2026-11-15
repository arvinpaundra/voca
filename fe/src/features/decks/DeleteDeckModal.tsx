import { useState } from "react";
import { Result } from "effect";
import type { DeckSummary } from "@voca/contract";
import { Button } from "../../components/Button";
import { session } from "../../lib/appSession";
import { Modal } from "./Modal";

type DeleteDeckModalProps = {
  // The deck awaiting confirmation; unset closes the dialog.
  deck: DeckSummary | null;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteDeckModal({ deck, onClose, onDeleted }: DeleteDeckModalProps) {
  return (
    <Modal open={deck !== null} title="Delete deck?" onClose={onClose}>
      {deck !== null && <DeleteDeckBody deck={deck} onCancel={onClose} onDeleted={onDeleted} />}
    </Modal>
  );
}

type DeleteDeckBodyProps = {
  deck: DeckSummary;
  onCancel: () => void;
  onDeleted: () => void;
};

function DeleteDeckBody({ deck, onCancel, onDeleted }: DeleteDeckBodyProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);

    const result = await session.call((client) =>
      client.library.deleteDeck({ params: { deckSlug: deck.slug } })
    );

    setBusy(false);
    if (Result.isSuccess(result)) {
      onDeleted();
      return;
    }

    setError("Could not delete the deck. Try again.");
  };

  return (
    <div className="grid gap-4">
      <p className="text-sm text-stone-600">All cards in this deck will be removed. This cannot be undone.</p>

      {error !== null && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => void confirm()}>
          {busy ? "Deleting…" : "Delete deck"}
        </Button>
      </div>
    </div>
  );
}
