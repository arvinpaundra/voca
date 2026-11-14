import { useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "../../components/Button";
import type { WordLabels } from "@voca/contract";
import styles from "./deck.module.css";
import { isComplete, type WordDraft } from "./wordModel";

type WordFormProps = {
  labels: WordLabels;
  initial: WordDraft;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (draft: WordDraft) => void;
  onCancel: () => void;
};

export function WordForm({ labels, initial, submitLabel, busy, error, onSubmit, onCancel }: WordFormProps) {
  const [draft, setDraft] = useState(initial);

  const change = (name: keyof WordDraft) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setDraft((previous) => ({ ...previous, [name]: value }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isComplete(draft)) onSubmit(draft);
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <label className={styles.field}>
        <span>{labels.term}</span>
        <input className={styles.input} dir="auto" required value={draft.term} onChange={change("term")} />
      </label>

      <label className={styles.field}>
        <span>{labels.reading}</span>
        <input className={styles.input} dir="auto" value={draft.reading} onChange={change("reading")} />
      </label>

      <label className={styles.field}>
        <span>Meaning</span>
        <input className={styles.input} dir="auto" required value={draft.meaning} onChange={change("meaning")} />
      </label>

      <label className={styles.field}>
        <span>Example</span>
        <textarea className={styles.input} dir="auto" rows={2} value={draft.example} onChange={change("example")} />
      </label>

      <label className={styles.field}>
        <span>Notes</span>
        <textarea className={styles.input} dir="auto" rows={2} value={draft.notes} onChange={change("notes")} />
      </label>

      {error !== null && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={busy || !isComplete(draft)}>
          {busy ? "Saving…" : submitLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
