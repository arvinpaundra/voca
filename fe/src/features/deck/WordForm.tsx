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

const textareaClass =
  "w-full resize-y rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 hover:border-stone-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy";

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
    <form ref={formRef} className="grid gap-4" onSubmit={submit}>
      <Input label={labels.term} dir="auto" required value={draft.term} onChange={change("term")} />

      <Input label={labels.reading} dir="auto" value={draft.reading} onChange={change("reading")} />

      <Input label="Meaning" dir="auto" required value={draft.meaning} onChange={change("meaning")} />

      <div className="grid gap-1.5">
        <label htmlFor="word-example" className="text-xs font-medium text-stone-700">
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
        <label htmlFor="word-notes" className="text-xs font-medium text-stone-700">
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
    </form>
  );
}
