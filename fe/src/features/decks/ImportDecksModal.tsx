import { useRef, useState, type FormEvent } from "react";
import { IMPORT_MAX_FILES } from "@voca/contract";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { startImport } from "../../lib/imports";
import { queryClient } from "../../lib/queryClient";
import { LanguageField, languageCodeMessage, languageCodePattern } from "./LanguageField";

type ImportDecksModalProps = {
  open: boolean;
  onClose: () => void;
};

export function ImportDecksModal({ open, onClose }: ImportDecksModalProps) {
  // Mounts only while open, so every opening starts with no file chosen and no message.
  if (!open) return null;

  return <ImportDecksDialog onClose={onClose} />;
}

type LanguageErrors = { termLang: string | null; meaningLang: string | null };

function ImportDecksDialog({ onClose }: { onClose: () => void }) {
  // The actions live in the dialog footer, outside the form, so Import submits the form through its ref.
  const formRef = useRef<HTMLFormElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [termLang, setTermLang] = useState("");
  const [meaningLang, setMeaningLang] = useState("");
  const [languageErrors, setLanguageErrors] = useState<LanguageErrors>({ termLang: null, meaningLang: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooManyFiles = files.length > IMPORT_MAX_FILES;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextTermLang = termLang.trim();
    const nextMeaningLang = meaningLang.trim();
    const nextLanguageErrors: LanguageErrors = {
      termLang: languageCodePattern.test(nextTermLang) ? null : languageCodeMessage,
      meaningLang: languageCodePattern.test(nextMeaningLang) ? null : languageCodeMessage,
    };

    setLanguageErrors(nextLanguageErrors);
    if (nextLanguageErrors.termLang !== null || nextLanguageErrors.meaningLang !== null) return;

    if (files.length === 0) {
      setError("Choose at least one CSV file.");
      return;
    }

    // Checked here too, so an oversized selection never reaches the server.
    if (tooManyFiles) return;

    setBusy(true);
    setError(null);

    try {
      await startImport({ files, termLang: nextTermLang, meaningLang: nextMeaningLang });
    } catch {
      setBusy(false);
      setError("Could not start the import. Try again.");
      return;
    }

    // The batch shows in the progress panel at once, not on the next stream event.
    void queryClient.invalidateQueries({ queryKey: ["imports"] });
    onClose();
  };

  return (
    <Modal
      open
      title="Import decks"
      description="Each CSV file becomes a new deck. The files import in the background; you can leave this page."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button busy={busy} disabled={tooManyFiles} onClick={() => formRef.current?.requestSubmit()}>
            Import
          </Button>
        </>
      }
    >
      <form ref={formRef} className="grid gap-4" onSubmit={(event) => void submit(event)}>
        <input
          type="file"
          multiple
          accept=".csv,text/csv"
          aria-label="CSV files"
          onChange={(event) => {
            setFiles(Array.from(event.currentTarget.files ?? []));
            setError(null);
          }}
        />

        <p role="status">
          {files.length === 1 ? "1 file chosen" : `${files.length} files chosen`}
        </p>

        <LanguageField
          label="Term language"
          value={termLang}
          error={languageErrors.termLang}
          onChange={(value) => {
            setTermLang(value);
            setLanguageErrors((previous) => ({ ...previous, termLang: null }));
          }}
        />

        <LanguageField
          label="Meaning language"
          value={meaningLang}
          error={languageErrors.meaningLang}
          onChange={(value) => {
            setMeaningLang(value);
            setLanguageErrors((previous) => ({ ...previous, meaningLang: null }));
          }}
        />

        {tooManyFiles && (
          <p role="alert" className="err">
            Choose at most {IMPORT_MAX_FILES} files. Nothing is imported.
          </p>
        )}

        {error !== null && (
          <p role="alert" className="err">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
