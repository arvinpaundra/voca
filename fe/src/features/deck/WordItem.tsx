import { useState } from "react";
import { Result } from "effect";
import type { Deck, WordWithCards } from "@voca/contract";
import { Button } from "../../components/Button";
import { session } from "../../lib/appSession";
import styles from "./deck.module.css";

type WordItemProps = {
  deck: Deck;
  word: WordWithCards;
  onEdit: () => void;
  onDeleted: (slug: string) => void;
};

export function WordItem({ deck, word, onEdit, onDeleted }: WordItemProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);

    const result = await session.call((client) => client.library.deleteWord({ params: { wordSlug: word.slug } }));

    setBusy(false);
    if (Result.isSuccess(result)) {
      onDeleted(word.slug);
      return;
    }
    setConfirming(false);
    setError("Could not delete the word. Try again.");
  };

  return (
    <article className={styles.word}>
      <div className={styles.wordHead}>
        {word.reading === null ? (
          <span className={styles.term} lang={deck.termLang} dir="auto">
            {word.term}
          </span>
        ) : (
          <ruby className={styles.term} lang={deck.termLang} dir="auto">
            {word.term}
            <rt>{word.reading}</rt>
          </ruby>
        )}
        <p className={styles.meaning} lang={deck.meaningLang} dir="auto">
          {word.meaning}
        </p>
      </div>

      {word.example !== null && <p className={styles.example} dir="auto">{word.example}</p>}
      {word.notes !== null && <p className={styles.note} dir="auto">{word.notes}</p>}
      {error !== null && <p className={styles.error} role="alert">{error}</p>}

      {confirming ? (
        <div className={styles.actions}>
          <span className={styles.note}>Delete this word?</span>
          <Button variant="accent" disabled={busy} onClick={() => void remove()}>
            Delete
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Keep
          </Button>
        </div>
      ) : (
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        </div>
      )}
    </article>
  );
}
