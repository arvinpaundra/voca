import { useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import type { WordLabels } from "@voca/contract";
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

const textareaClass =
  "w-full resize-y rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-stone-900 placeholder:text-stone-400 hover:border-stone-400 focus:outline-none focus:ring-2 focus:ring-lime/60";

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
    <form className="flex flex-col gap-4 p-6" onSubmit={submit}>
      <Input label={labels.term} dir="auto" required value={draft.term} onChange={change("term")} />

      <Input label={labels.reading} dir="auto" value={draft.reading} onChange={change("reading")} />

      <Input label="Meaning" dir="auto" required value={draft.meaning} onChange={change("meaning")} />

      <div className="grid gap-1.5">
        <label htmlFor="word-example" className="text-sm font-medium text-stone-700">
          Example
        </label>
        <textarea
          id="word-example"
          className={textareaClass}
          dir="auto"
          rows={2}
          value={draft.example}
          onChange={change("example")}
        />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="word-notes" className="text-sm font-medium text-stone-700">
          Notes
        </label>
        <textarea
          id="word-notes"
          className={textareaClass}
          dir="auto"
          rows={2}
          value={draft.notes}
          onChange={change("notes")}
        />
      </div>

      {error !== null && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={busy || !isComplete(draft)}>
          {busy ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
