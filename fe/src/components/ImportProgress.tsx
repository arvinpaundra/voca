import { useState } from "react";
import type { ImportBatch, ImportFile } from "@voca/contract";
import { Check, ChevronDown, ChevronRight, ChevronUp, CircleAlert, Upload, X } from "lucide-react";
import { dismissImport, importProgress, type ImportProgress as Progress } from "../lib/imports";
import { queryClient } from "../lib/queryClient";
import { IconButton } from "./IconButton";

// The batches still on the server, newest first. Docked bottom-right on every page while any batch is not dismissed.
export function ImportProgress({ batches }: { batches: ReadonlyArray<ImportBatch> }) {
  const [folded, setFolded] = useState(false);

  if (batches.length === 0) return null;

  return (
    <section aria-label="Imports" className="import-dock">
      <div className="import-panel">
        <div className="import-head">
          <h2>{headline(batches)}</h2>

          <IconButton label={folded ? "Expand" : "Fold"} onClick={() => setFolded((value) => !value)}>
            {folded ? <ChevronUp className="i" aria-hidden="true" /> : <ChevronDown className="i" aria-hidden="true" />}
          </IconButton>
        </div>

        {!folded && (
          <div className="import-body">
            {batches.map((batch) => (
              <BatchRow key={batch.slug} batch={batch} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// While a batch runs, the header counts its files; once none runs, it counts the decks created.
function headline(batches: ReadonlyArray<ImportBatch>): string {
  const running = batches.filter((batch) => !importProgress(batch).finished);

  if (running.length > 0) {
    const done = running.reduce((sum, batch) => sum + importProgress(batch).done, 0);
    const total = running.reduce((sum, batch) => sum + importProgress(batch).total, 0);

    return `Importing ${done} of ${total} files`;
  }

  const created = batches.reduce((sum, batch) => sum + createdCount(batch), 0);
  const total = batches.reduce((sum, batch) => sum + batch.files.length, 0);

  return `Import finished · ${created} of ${total} decks`;
}

function createdCount(batch: ImportBatch): number {
  return batch.files.filter((file) => file.deck !== null).length;
}

function batchStatus(batch: ImportBatch, progress: Progress): string {
  if (!progress.finished) return `${progress.done} of ${progress.total}`;

  const created = createdCount(batch);

  if (created === progress.total) return `${created} decks created`;

  return `${created} of ${progress.total} created`;
}

// A running batch starts open so its files show; a finished one starts closed.
function BatchRow({ batch }: { batch: ImportBatch }) {
  const progress = importProgress(batch);
  const [open, setOpen] = useState(!progress.finished);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const percent = progress.total === 0 ? 100 : Math.round((progress.done / progress.total) * 100);

  const dismiss = async () => {
    setBusy(true);
    setFailed(false);

    try {
      await dismissImport(batch.slug);
    } catch {
      setBusy(false);
      setFailed(true);
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["imports"] });
  };

  return (
    <div className="import-batch">
      <div className="import-sum">
        <button type="button" className="import-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? <ChevronDown className="i" aria-hidden="true" /> : <ChevronRight className="i" aria-hidden="true" />}
          <span>
            <b>{batch.files.length} files</b> · {batch.termLang} → {batch.meaningLang}
          </span>
          <span className="import-meta">{batchStatus(batch, progress)}</span>
        </button>

        {progress.finished && (
          <IconButton label="Dismiss" disabled={busy} onClick={() => void dismiss()}>
            <X className="i" aria-hidden="true" />
          </IconButton>
        )}

        <div
          className="import-track"
          role="progressbar"
          aria-label="Files imported"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
        >
          <span style={{ width: `${percent}%` }} />
        </div>

        {failed && (
          <p role="alert" className="import-alert">
            Could not dismiss the import. Try again.
          </p>
        )}
      </div>

      {open && (
        <ul className="import-files">
          {batch.files.map((file, index) => (
            <FileRow key={index} file={file} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FileRow({ file }: { file: ImportFile }) {
  return (
    <li className="import-file">
      <FileIcon file={file} />

      <div>
        <span className="import-name" dir="auto">
          {file.name}
        </span>
        <FileDetail file={file} />
      </div>

      {file.status === "failed" && <FileErrors file={file} />}
    </li>
  );
}

function FileIcon({ file }: { file: ImportFile }) {
  if (file.status === "running") {
    return <span className="run" role="img" aria-label="Importing" />;
  }

  if (file.status === "pending") {
    return <Upload className="i wait" aria-hidden="true" />;
  }

  if (file.status === "failed") {
    return <CircleAlert className="i bad" aria-hidden="true" />;
  }

  return <Check className="i ok" aria-hidden="true" />;
}

function FileDetail({ file }: { file: ImportFile }) {
  if (file.status === "running") {
    return <div className="import-meta">Importing…</div>;
  }

  if (file.status === "pending") {
    return <div className="import-meta">Waiting</div>;
  }

  if (file.status === "failed") {
    return (
      <div className="import-meta">
        No deck created · {file.totalErrors} problems
      </div>
    );
  }

  return (
    <div className="import-meta">
      {file.deck !== null && (
        <a href={`/app/decks/${file.deck.slug}`} dir="auto">
          {file.deck.title}
        </a>
      )}
      {` · ${file.imported} added · ${file.skippedDuplicates} skipped`}
    </div>
  );
}

function FileErrors({ file }: { file: ImportFile }) {
  const hidden = file.totalErrors - file.errors.length;

  return (
    <div className="import-errors">
      {file.errors.map((rowError, index) => (
        <span key={index}>
          Row {rowError.row}: {rowError.message}
        </span>
      ))}

      {hidden > 0 && <span>…and {hidden} more</span>}
    </div>
  );
}
