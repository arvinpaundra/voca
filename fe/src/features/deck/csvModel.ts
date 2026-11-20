import type { ImportRejected, ImportResult } from "@voca/contract";
import { failureTag } from "./wordModel";

/** What the import modal shows when an upload fails: a headline, one line per reported row error, and how many more. */
export interface ImportFailure {
  readonly message: string;
  readonly rows: readonly string[];
  readonly more: number;
}

const GENERIC_FAILURE = "Could not import the file. Try again.";

const isImportRejected = (error: unknown): error is ImportRejected => failureTag(error) === "ImportRejected";

const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);

const rowLine = (row: number, column: string | null, message: string): string =>
  column === null ? `Row ${row}: ${message}` : `Row ${row}, ${column}: ${message}`;

/** The line shown once an import succeeds. */
export const importSummary = (result: ImportResult): string => {
  const imported = `Imported ${result.imported} ${plural(result.imported, "word", "words")}`;

  if (result.skippedDuplicates === 0) return imported;

  const skipped = `skipped ${result.skippedDuplicates} ${plural(result.skippedDuplicates, "duplicate", "duplicates")}`;

  return `${imported} · ${skipped}`;
};

/** The failure to show for whatever the import call failed with: a contract error, or anything else. */
export const importFailure = (error: unknown): ImportFailure => {
  if (isImportRejected(error)) {
    return {
      message: error.message,
      rows: error.errors.map((rowError) => rowLine(rowError.row, rowError.column, rowError.message)),
      more: error.totalErrors - error.errors.length,
    };
  }

  const tag = failureTag(error);

  if (tag === "PayloadTooLarge") return { message: "The file is larger than 5 MB.", rows: [], more: 0 };

  if (tag === "NotFound") return { message: "This deck no longer exists.", rows: [], more: 0 };

  return { message: GENERIC_FAILURE, rows: [], more: 0 };
};

/** The name the exported file is saved under. */
export const exportFileName = (deckSlug: string): string => `${deckSlug}.csv`;
