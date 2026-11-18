import { useRef, useState } from "react";
import { Result } from "effect";
import type { Deck, Word, WordLabels, WordWithCards } from "@voca/contract";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { session } from "../../lib/appSession";
import { WordForm } from "./WordForm";
import {
  createPayload,
  DUPLICATE_MESSAGE,
  draftFromWord,
  emptyDraft,
  failureTag,
  isComplete,
  updatePayload,
  type WordDraft,
} from "./wordModel";

type WordModalProps = {
  open: boolean;
  deck: Deck;
  labels: WordLabels;
  // Set to edit that word; unset to add a new one.
  word?: WordWithCards | undefined;
  onClose: () => void;
  onSaved: (word: Word) => void;
};

export function WordModal({ open, deck, labels, word, onClose, onSaved }: WordModalProps) {
  // Mounts only while open, so every opening starts from a fresh draft.
  if (!open) return null;

  return <WordEditor deck={deck} labels={labels} word={word} onClose={onClose} onSaved={onSaved} />;
}

type WordEditorProps = {
  deck: Deck;
  labels: WordLabels;
  word?: WordWithCards | undefined;
  onClose: () => void;
  onSaved: (word: Word) => void;
};

function WordEditor({ deck, labels, word, onClose, onSaved }: WordEditorProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<WordDraft>(word === undefined ? emptyDraft : draftFromWord(word));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeDraft = (name: keyof WordDraft, value: string) => {
    setDraft((previous) => ({ ...previous, [name]: value }));
  };

  const save = async () => {
    setBusy(true);
    setError(null);

    const result =
      word === undefined
        ? await session.call((client) =>
            client.library.createWord({ params: { deckSlug: deck.slug }, payload: createPayload(draft) }),
          )
        : await session.call((client) =>
            client.library.updateWord({ params: { wordSlug: word.slug }, payload: updatePayload(draft) }),
          );

    setBusy(false);
    if (Result.isSuccess(result)) {
      onSaved(result.success);
      return;
    }

    setError(failureTag(result.failure) === "DuplicateWord" ? DUPLICATE_MESSAGE : "Could not save the word. Try again.");
  };

  return (
    <Modal
      open
      title={word === undefined ? "Add word" : "Edit word"}
      description={word === undefined ? "Add a word to this deck." : "Change this word."}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            busy={busy}
            disabled={!isComplete(draft)}
            onClick={() => formRef.current?.requestSubmit()}
          >
            {word === undefined ? "Add word" : "Save"}
          </Button>
        </>
      }
    >
      <WordForm
        labels={labels}
        draft={draft}
        formRef={formRef}
        onChange={changeDraft}
        onSubmit={() => void save()}
      />

      {error !== null && (
        <p role="alert" className="err">
          {error}
        </p>
      )}
    </Modal>
  );
}
