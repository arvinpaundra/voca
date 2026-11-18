import { useState } from "react";
import { Result } from "effect";
import type { WordWithCards } from "@voca/contract";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { session } from "../../lib/appSession";

type DeleteWordModalProps = {
  // The word awaiting confirmation; unset closes the dialog.
  word: WordWithCards | null;
  onClose: () => void;
  onDeleted: (slug: string) => void;
};

export function DeleteWordModal({ word, onClose, onDeleted }: DeleteWordModalProps) {
  // Mounts only while a word awaits confirmation, so every confirmation starts with no error.
  if (word === null) return null;

  return <DeleteWordDialog word={word} onClose={onClose} onDeleted={onDeleted} />;
}

type DeleteWordDialogProps = {
  word: WordWithCards;
  onClose: () => void;
  onDeleted: (slug: string) => void;
};

function DeleteWordDialog({ word, onClose, onDeleted }: DeleteWordDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);

    const result = await session.call((client) => client.library.deleteWord({ params: { wordSlug: word.slug } }));

    setBusy(false);
    if (Result.isSuccess(result)) {
      onDeleted(word.slug);
      return;
    }

    setError("Could not delete the word. Try again.");
  };

  return (
    <Modal
      open
      title="Delete word?"
      description="The word and its cards will be removed from this deck."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep
          </Button>
          <Button variant="danger" busy={busy} onClick={() => void confirm()}>
            Delete word
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
