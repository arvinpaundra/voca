import { useId, useRef, useState } from "react";
import { Result } from "effect";
import { BookOpen, CircleAlert, Upload } from "lucide-react";
import type { DeckDetail, ImportResult } from "@voca/contract";
import { Button } from "../../components/Button";
import { ColumnMatch, useFileHeaders } from "../../components/ColumnMatch";
import { Modal } from "../../components/Modal";
import { chooseField, columnLabel, initialMatch, missingLines, UNREADABLE, type Match } from "../../lib/columnMatch";
import { importCsvFile } from "../../lib/imports";
import { importFailure, importSummary, type ImportFailure } from "./csvModel";

type CsvImportModalProps = {
  open: boolean;
  deckSlug: DeckDetail["slug"];
  onClose: () => void;
  onImported: (result: ImportResult) => void;
};

export function CsvImportModal({ open, deckSlug, onClose, onImported }: CsvImportModalProps) {
  // Mounts only while open, so every opening starts with no file chosen and no message.
  if (!open) return null;

  return <CsvImportDialog deckSlug={deckSlug} onClose={onClose} onImported={onImported} />;
}

type CsvImportDialogProps = {
  deckSlug: DeckDetail["slug"];
  onClose: () => void;
  onImported: (result: ImportResult) => void;
};

const sizeLabel = (bytes: number): string => `${Math.max(1, Math.round(bytes / 1024))} KB`;

function CsvImportDialog({ deckSlug, onClose, onImported }: CsvImportDialogProps) {
  const inputId = useId();
  const pickerRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<ReadonlyArray<File>>([]);
  const [choice, setChoice] = useState<ReadonlyArray<Match> | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [failure, setFailure] = useState<ImportFailure | null>(null);

  const headers = useFileHeaders(files);
  const file = files[0];
  const header = file === undefined ? undefined : headers.get(file);
  const names = header?.kind === "read" ? header.names : null;
  const match = names === null ? null : (choice ?? initialMatch(names));
  const lines = match === null ? [] : missingLines(match);
  const canImport = file !== undefined && match !== null && lines.length === 0;

  const rows =
    names === null || match === null
      ? []
      : names.map((name, index) => ({
          label: columnLabel(name, index),
          blank: name.trim() === "",
          match: match[index] ?? null,
          files: null,
        }));

  const chooseFile = (chosen: File | undefined) => {
    setFiles(chosen === undefined ? [] : [chosen]);
    setChoice(null);
    setSummary(null);
    setFailure(null);
  };

  const choose = (index: number, field: Match) => {
    if (match === null) return;

    setChoice(chooseField(match, index, field));
  };

  const importFile = async () => {
    if (file === undefined || match === null) return;

    setBusy(true);
    setSummary(null);
    setFailure(null);

    const result = await importCsvFile({ deckSlug, file, columns: match });

    setBusy(false);
    if (Result.isSuccess(result)) {
      setSummary(importSummary(result.success));
      onImported(result.success);
      return;
    }

    setFailure(importFailure(result.failure));
  };

  return (
    <Modal
      open
      title="Import CSV"
      description="Add the words in a CSV file to this deck. Nothing is imported if the file has errors."
      onClose={onClose}
      footer={
        summary !== null ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button busy={busy} disabled={!canImport} onClick={() => void importFile()}>
              Import
            </Button>
          </>
        )
      }
    >
      <input
        id={inputId}
        ref={pickerRef}
        type="file"
        accept=".csv,text/csv"
        aria-label="CSV file"
        className="sr-only"
        onChange={(event) => chooseFile(event.currentTarget.files?.[0])}
      />

      {file === undefined ? (
        <label htmlFor={inputId} className="file-drop">
          <Upload className="i i-lg" aria-hidden="true" />
          <span>
            <b>Choose a file</b> or drop it here
          </span>
          <span className="hint">CSV with a header row · UTF-8 · up to 5 MB</span>
        </label>
      ) : (
        <div className="chosen">
          <BookOpen className="i" aria-hidden="true" />
          <span className="grow">
            <b>{file.name}</b> · {sizeLabel(file.size)}
          </span>
          <Button variant="ghost" size="sm" aria-label="Change file" disabled={busy} onClick={() => pickerRef.current?.click()}>
            <span className="cf-full">Change file</span>
            <span className="cf-short">Change</span>
          </Button>
        </div>
      )}

      {header?.kind === "unreadable" && (
        <div role="alert" className="alert alert-bad">
          <CircleAlert className="i" aria-hidden="true" />
          <span className="grow">{UNREADABLE}</span>
        </div>
      )}

      {rows.length > 0 && <ColumnMatch rows={rows} lines={lines} onChoose={choose} />}

      {summary !== null && <p role="status">{summary}</p>}

      {failure !== null && (
        <div role="alert" className="err">
          <p>{failure.message}</p>

          {failure.rows.length > 0 && (
            <ul>
              {failure.rows.map((row) => (
                <li key={row}>{row}</li>
              ))}
            </ul>
          )}

          {failure.more > 0 && <p>and {failure.more} more</p>}
        </div>
      )}
    </Modal>
  );
}
