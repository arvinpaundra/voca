import type { ImportResult } from "@voca/contract";

/** What the import modal shows when an upload fails: a headline, one line per reported row error, and how many more. */
export interface ImportFailure {
  readonly message: string;
  readonly rows: readonly string[];
  readonly more: number;
}

const notImplemented = "not implemented: CSVF";

/** The line shown once an import succeeds. */
export const importSummary = (_result: ImportResult): string => notImplemented;

/** The failure to show for whatever the import call failed with: a contract error, or anything else. */
export const importFailure = (_error: unknown): ImportFailure => ({ message: notImplemented, rows: [], more: 0 });

/** The name the exported file is saved under. */
export const exportFileName = (_deckSlug: string): string => notImplemented;
