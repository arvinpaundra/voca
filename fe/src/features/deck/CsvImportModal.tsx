import { useState } from "react";
import { Result } from "effect";
import type { DeckDetail, ImportResult } from "@voca/contract";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";
import { session } from "../../lib/appSession";
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

function CsvImportDialog({ deckSlug, onClose, onImported }: CsvImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [failure, setFailure] = useState<ImportFailure | null>(null);

  const chooseFile = (chosen: File | undefined) => {
    setFile(chosen ?? null);
    setSummary(null);
    setFailure(null);
  };

  const importFile = async () => {
    if (file === null) return;

    const payload = new FormData();
    payload.append("file", file);

    setBusy(true);
    setSummary(null);
    setFailure(null);

    const result = await session.call((client) =>
      client.library.importCsv({ params: { deckSlug }, payload }),
    );

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
            <Button busy={busy} disabled={file === null} onClick={() => void importFile()}>
              Import
            </Button>
          </>
        )
      }
    >
      <a href={`data:text/csv;charset=utf-8,${encodeURIComponent("not implemented: DF")}`} download="voca-template.csv">
        Download template
      </a>

      <input
        type="file"
        accept=".csv,text/csv"
        aria-label="CSV file"
        onChange={(event) => chooseFile(event.currentTarget.files?.[0])}
      />

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
