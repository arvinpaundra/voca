import { useId, useRef, useState, type FormEvent } from "react";
import { CircleAlert, Upload } from "lucide-react";
import { IMPORT_MAX_FILES, IMPORT_MAX_TOTAL_BYTES } from "@voca/contract";
import { Button } from "../../components/Button";
import { ColumnMatch, useFileHeaders, type ColumnRow } from "../../components/ColumnMatch";
import { Modal } from "../../components/Modal";
import {
  BATCH_UNREADABLE,
  batchProblems,
  batchRows,
  fileColumns,
  initialBatchMatch,
  matchOf,
  type BatchMatch,
  type Match
} from "../../lib/columnMatch";
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

/** True when the files together are over the batch's byte limit. */
function overTotalLimit(files: File[]): boolean {
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  return totalBytes > IMPORT_MAX_TOTAL_BYTES;
}

type LanguageErrors = { termLang: string | null; meaningLang: string | null };

function ImportDecksDialog({ onClose }: { onClose: () => void }) {
  // The actions live in the dialog footer, outside the form, so Import submits the form through its ref.
  const formRef = useRef<HTMLFormElement>(null);
  const inputId = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [choice, setChoice] = useState<BatchMatch | null>(null);
  const [termLang, setTermLang] = useState("");
  const [meaningLang, setMeaningLang] = useState("");
  const [languageErrors, setLanguageErrors] = useState<LanguageErrors>({ termLang: null, meaningLang: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = useFileHeaders(files);
  const tooManyFiles = files.length > IMPORT_MAX_FILES;
  const tooLarge = overTotalLimit(files);
  const loaded = files.every((file) => headers.has(file));
  const unreadable = files.filter((file) => headers.get(file)?.kind === "unreadable");
  const batch = files.flatMap((file) => {
    const header = headers.get(file);

    return header?.kind === "read" ? [{ file, name: file.name, header: header.names }] : [];
  });
  const rows = batchRows(batch);
  const match = choice ?? initialBatchMatch(rows);
  const problems = batchProblems(batch, match);
  const blocked = !loaded || unreadable.length > 0 || problems.length > 0 || tooManyFiles || tooLarge;

  const rowViews: ReadonlyArray<ColumnRow> = rows.map((row) => ({
    label: row.label,
    blank: row.key === "",
    match: matchOf(match, row.key),
    files: row.files,
  }));

  const chooseFiles = (chosen: File[]) => {
    setFiles(chosen);
    setChoice(null);
    setError(null);
  };

  const removeFile = (removed: File) => {
    setFiles(files.filter((file) => file !== removed));
    setError(null);
  };

  const choose = (index: number, field: Match) => {
    const row = rows[index];

    if (row === undefined) return;

    setChoice({ ...match, [row.key]: field });
  };

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
    if (tooManyFiles || tooLarge || blocked) return;

    setBusy(true);
    setError(null);

    try {
      await startImport({
        files,
        termLang: nextTermLang,
        meaningLang: nextMeaningLang,
        columns: batch.map((entry) => fileColumns(entry.header, match)),
      });
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
          <Button
            busy={busy}
            disabled={blocked}
            onClick={() => formRef.current?.requestSubmit()}
          >
            Import
          </Button>
        </>
      }
    >
      <form ref={formRef} className="grid gap-4" onSubmit={(event) => void submit(event)}>
        <input
          id={inputId}
          type="file"
          multiple
          accept=".csv,text/csv"
          aria-label="CSV files"
          className="sr-only"
          onChange={(event) => chooseFiles(Array.from(event.currentTarget.files ?? []))}
        />

        <label htmlFor={inputId} className="file-drop">
          <Upload className="i i-lg" aria-hidden="true" />
          <span>
            <b>Choose files</b> or drop them here
          </span>
          <span className="hint">CSV with a header row · UTF-8 · 5 MB each</span>
        </label>

        <p role="status" className="hint">
          {files.length === 1 ? "1 file chosen" : `${files.length} files chosen`}
        </p>

        {loaded && rowViews.length > 0 && <ColumnMatch rows={rowViews} lines={problems} onChoose={choose} />}

        {unreadable.map((file, index) => (
          <div key={index} role="alert" className="alert alert-bad">
            <CircleAlert className="i" aria-hidden="true" />
            <span className="grow">
              <b>{file.name}</b>: {BATCH_UNREADABLE}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-label={`Remove ${file.name}`}
              onClick={() => removeFile(file)}
            >
              Remove
            </button>
          </div>
        ))}

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

        {!tooManyFiles && tooLarge && (
          <p role="alert" className="err">
            Choose files totalling at most 50 MB. Nothing is imported.
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
