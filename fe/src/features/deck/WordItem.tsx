import { useState } from "react";
import { Result } from "effect";
import type { Deck, Word, WordWithCards } from "@voca/contract";
import { Button } from "../../components/Button";
import { session } from "../../lib/appSession";
import type { WordLabels } from "../../lib/wordLabels";
import styles from "./deck.module.css";
import { WordForm } from "./WordForm";
import { DUPLICATE_MESSAGE, draftFromWord, failureTag, updatePayload, type WordDraft } from "./wordModel";

type WordItemProps = {
  deck: Deck;
  labels: WordLabels;
  word: WordWithCards;
  onUpdated: (word: Word) => void;
  onDeleted: (slug: string) => void;
};

type Mode = "view" | "edit" | "confirm-delete";

export function WordItem({ deck, labels, word, onUpdated, onDeleted }: WordItemProps) {
  const [mode, setMode] = useState<Mode>("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (draft: WordDraft) => {
    setBusy(true);
    setError(null);

    const result = await session.call((client) =>
      client.library.updateWord({ params: { wordSlug: word.slug }, payload: updatePayload(draft) })
    );

    setBusy(false);
    if (Result.isSuccess(result)) {
      onUpdated(result.success);
      setMode("view");
      return;
    }
    setError(failureTag(result.failure) === "DuplicateWord" ? DUPLICATE_MESSAGE : "Could not save the word. Try again.");
  };

  const remove = async () => {
    setBusy(true);
    setError(null);

    const result = await session.call((client) => client.library.deleteWord({ params: { wordSlug: word.slug } }));

    setBusy(false);
    if (Result.isSuccess(result)) {
      onDeleted(word.slug);
      return;
    }
    setMode("view");
    setError("Could not delete the word. Try again.");
  };

  if (mode === "edit") {
    return (
      <WordForm
        labels={labels}
        initial={draftFromWord(word)}
        submitLabel="Save"
        busy={busy}
        error={error}
        onSubmit={(draft) => void save(draft)}
        onCancel={() => {
          setMode("view");
          setError(null);
        }}
      />
    );
  }

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

      {mode === "confirm-delete" ? (
        <div className={styles.actions}>
          <span className={styles.note}>Delete this word?</span>
          <Button variant="accent" disabled={busy} onClick={() => void remove()}>
            Delete
          </Button>
          <Button variant="ghost" onClick={() => setMode("view")}>
            Keep
          </Button>
        </div>
      ) : (
        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => setMode("edit")}>
            Edit
          </Button>
          <Button variant="ghost" onClick={() => setMode("confirm-delete")}>
            Delete
          </Button>
        </div>
      )}
    </article>
  );
}
