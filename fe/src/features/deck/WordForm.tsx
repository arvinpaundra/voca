import { useEffect, useState, type ChangeEvent, type CSSProperties, type FormEvent, type Ref } from "react";
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

const WIDE_QUERY = "(min-width: 560px)";

// Two columns only where the viewport can hold them. Without matchMedia (or on failure) it stays one column.
function useWideViewport(): boolean {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    let query: MediaQueryList;

    try {
      query = window.matchMedia(WIDE_QUERY);
    } catch {
      return;
    }

    const update = () => setWide(query.matches);

    update();
    query.addEventListener("change", update);

    return () => query.removeEventListener("change", update);
  }, []);

  return wide;
}

// The form scrolls inside the dialog instead of growing it, so the footer stays in reach on a phone.
const FORM_SCROLL: CSSProperties = { maxHeight: "min(60vh, 460px)", overflowY: "auto", padding: 2 };

// The fields only: the dialog footer owns the actions and submits this form through `formRef`.
export function WordForm({ labels, draft, formRef, onChange, onSubmit }: WordFormProps) {
  const wide = useWideViewport();

  const change = (name: keyof WordDraft) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(name, event.target.value);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isComplete(draft)) onSubmit();
  };

  return (
    <form ref={formRef} className="grid gap-4" style={FORM_SCROLL} onSubmit={submit}>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: wide ? "1fr 1fr" : "1fr" }}>
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
