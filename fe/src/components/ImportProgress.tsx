import { useState } from "react";
import type { ImportBatch, ImportFile } from "@voca/contract";
import { dismissImport, importProgress } from "../lib/imports";
import { queryClient } from "../lib/queryClient";
import { Button } from "./Button";
import { Card } from "./Card";

// The batches still on the server, newest first. Shown on every page while any batch is not dismissed.
export function ImportProgress({ batches }: { batches: ReadonlyArray<ImportBatch> }) {
  if (batches.length === 0) return null;

  return (
    <section aria-label="Imports" className="import-panel">
      {batches.map((batch) => (
        <BatchCard key={batch.slug} batch={batch} />
      ))}
    </section>
  );
}

function BatchCard({ batch }: { batch: ImportBatch }) {
  const progress = importProgress(batch);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const percent = progress.total === 0 ? 100 : Math.round((progress.done / progress.total) * 100);

  const dismiss = async () => {
    setBusy(true);
    setError(null);

    try {
      await dismissImport(batch.slug);
    } catch {
      setBusy(false);
      setError("Could not dismiss the import. Try again.");
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["imports"] });
  };

  return (
    <Card aria-label={progress.finished ? "Import finished" : "Import running"}>
      <div className="card-head">
        <h2 className="import-title">{progress.finished ? "Import finished" : "Importing decks"}</h2>

        {progress.finished && (
          <Button variant="ghost" size="sm" busy={busy} onClick={() => void dismiss()}>
            Dismiss
          </Button>
        )}
      </div>

      {!progress.finished && (
        <>
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

          <p className="import-meta">
            {progress.done} of {progress.total} files
            {progress.current !== null && <> · {progress.current}</>}
          </p>
        </>
      )}

      {progress.finished && (
        <ul className="import-files">
          {batch.files.map((file, index) => (
            <FileResult key={index} file={file} />
          ))}
        </ul>
      )}

      {error !== null && (
        <p role="alert" className="err">
          {error}
        </p>
      )}
    </Card>
  );
}

function FileResult({ file }: { file: ImportFile }) {
  const hidden = file.totalErrors - file.errors.length;

  return (
    <li className="import-file">
      <span className="import-name" dir="auto">
        {file.name}
      </span>

      {file.deck !== null && (
        <>
          <a href={`/app/decks/${file.deck.slug}`} dir="auto">
            {file.deck.title}
          </a>
          <span className="import-meta">
            {file.imported} words added, {file.skippedDuplicates} duplicates skipped
          </span>
        </>
      )}

      {file.deck === null && (
        <div role="alert" className="err">
          {file.errors.map((rowError, index) => (
            <p key={index}>
              Row {rowError.row}: {rowError.message}
            </p>
          ))}

          {hidden > 0 && <p>and {hidden} more</p>}
        </div>
      )}
    </li>
  );
}
