import type { ChangeEvent, FormEvent, Ref } from "react";
import { Input } from "../../components/Input";
import type { WordLabels } from "@voca/contract";
import { isComplete, type WordDraft } from "./wordModel";

type WordFormProps = {
  labels: WordLabels;
  draft: WordDraft;
  formRef: Ref<HTMLFormElement>;
  onChange: (name: keyof WordDraft, value: string) => void;
  onSubmit: () => void;
};

// The fields only: the dialog footer owns the actions and submits this form through `formRef`.
export function WordForm({ labels, draft, formRef, onChange, onSubmit }: WordFormProps) {
  const change = (name: keyof WordDraft) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(name, event.target.value);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isComplete(draft)) onSubmit();
  };

  return (
    <form ref={formRef} className="word-form" onSubmit={submit}>
      <div className="pair">
        <Input label={labels.term} dir="auto" required value={draft.term} onChange={change("term")} />

        <Input label={labels.reading} dir="auto" value={draft.reading} onChange={change("reading")} />
      </div>

      <Input label="Meaning" dir="auto" required value={draft.meaning} onChange={change("meaning")} />

      <div className="field">
        <label htmlFor="word-example">
          Example
        </label>
        <textarea
          id="word-example"
          className="textarea"
          dir="auto"
          rows={3}
          value={draft.example}
          onChange={change("example")}
        />
      </div>

      <div className="field">
        <label htmlFor="word-notes">
          Notes
        </label>
        <textarea
          id="word-notes"
          className="textarea"
          dir="auto"
          rows={3}
          value={draft.notes}
          onChange={change("notes")}
        />
      </div>
    </form>
  );
}
