import { useState } from "react";
import { Result } from "effect";
import type { Deck, Word, WordLabels, WordWithCards } from "@voca/contract";
import { session } from "../../lib/appSession";
import { Modal } from "../decks/Modal";
import { WordForm } from "./WordForm";
import {
  createPayload,
  DUPLICATE_MESSAGE,
  draftFromWord,
  emptyDraft,
  failureTag,
  updatePayload,
  type WordDraft
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
  return (
    <Modal open={open} title={word === undefined ? "Add word" : "Edit word"} onClose={onClose}>
      <WordEditor deck={deck} labels={labels} word={word} onCancel={onClose} onSaved={onSaved} />
    </Modal>
  );
}

type WordEditorProps = {
  deck: Deck;
  labels: WordLabels;
  word?: WordWithCards | undefined;
  onCancel: () => void;
  onSaved: (word: Word) => void;
};

function WordEditor({ deck, labels, word, onCancel, onSaved }: WordEditorProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (draft: WordDraft) => {
    setBusy(true);
    setError(null);

    const result =
      word === undefined
        ? await session.call((client) =>
            client.library.createWord({ params: { deckSlug: deck.slug }, payload: createPayload(draft) })
          )
        : await session.call((client) =>
            client.library.updateWord({ params: { wordSlug: word.slug }, payload: updatePayload(draft) })
          );

    setBusy(false);
    if (Result.isSuccess(result)) {
      onSaved(result.success);
      return;
    }

    setError(failureTag(result.failure) === "DuplicateWord" ? DUPLICATE_MESSAGE : "Could not save the word. Try again.");
  };

  return (
    <WordForm
      labels={labels}
      initial={word === undefined ? emptyDraft : draftFromWord(word)}
      submitLabel={word === undefined ? "Add word" : "Save"}
      busy={busy}
      error={error}
      onSubmit={(draft) => void save(draft)}
      onCancel={onCancel}
    />
  );
}
