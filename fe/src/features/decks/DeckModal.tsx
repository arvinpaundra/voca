import { useState, type FormEvent } from "react";
import { Result } from "effect";
import type { Deck } from "@voca/contract";
import { Button } from "../../components/Button";
import { session } from "../../lib/appSession";
import { failureTag } from "../deck/wordModel";
import { Modal } from "./Modal";
import styles from "./decks.module.css";

type DeckModalProps = {
  open: boolean;
  // Set to edit that deck; unset to create a new one.
  deck?: Deck | undefined;
  onClose: () => void;
  onSaved: (deck: Deck) => void;
};

export function DeckModal({ open, deck, onClose, onSaved }: DeckModalProps) {
  return (
    <Modal open={open} title={deck === undefined ? "New deck" : "Edit deck"} onClose={onClose}>
      <DeckForm deck={deck} onCancel={onClose} onSaved={onSaved} />
    </Modal>
  );
}

type DeckFormProps = {
  deck?: Deck | undefined;
  onCancel: () => void;
  onSaved: (deck: Deck) => void;
};

function DeckForm({ deck, onCancel, onSaved }: DeckFormProps) {
  const [title, setTitle] = useState(deck?.title ?? "");
  const [description, setDescription] = useState(deck?.description ?? "");
  const [termLang, setTermLang] = useState(deck?.termLang ?? "");
  const [meaningLang, setMeaningLang] = useState(deck?.meaningLang ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const fields = {
      title: title.trim(),
      description: description.trim(),
      meaningLang: meaningLang.trim()
    };
    const nextTermLang = termLang.trim();

    // The term language is sent only when it changes, so a deck with words can still be renamed.
    const result =
      deck === undefined
        ? await session.call((client) =>
            client.library.createDeck({ payload: { ...fields, termLang: nextTermLang } })
          )
        : await session.call((client) =>
            client.library.updateDeck({
              params: { deckSlug: deck.slug },
              payload: nextTermLang === deck.termLang ? fields : { ...fields, termLang: nextTermLang }
            })
          );

    setBusy(false);
    if (Result.isSuccess(result)) {
      onSaved(result.success);
      return;
    }

    setError(
      failureTag(result.failure) === "Forbidden"
        ? "The term language can't change once the deck has words."
        : "Could not save the deck. Try again."
    );
  };

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <label className={styles.field}>
        <span>Title</span>
        <input className={styles.input} dir="auto" required value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>

      <label className={styles.field}>
        <span>Description</span>
        <textarea
          className={styles.input}
          dir="auto"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span>Term language</span>
        <input
          className={styles.input}
          required
          placeholder="ja"
          value={termLang}
          onChange={(event) => setTermLang(event.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span>Meaning language</span>
        <input
          className={styles.input}
          required
          placeholder="en"
          value={meaningLang}
          onChange={(event) => setMeaningLang(event.target.value)}
        />
      </label>

      {error !== null && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
