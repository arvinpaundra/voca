import { queryOptions, type QueryClient } from "@tanstack/react-query"
import type { ImportBatch, ImportBatchSlug } from "@voca/contract"

// Importing several decks (FR-29): start a batch, read the batches, and follow their progress live over SSE.

export interface ImportProgress {
  /** Files finished, imported or failed. */
  readonly done: number
  readonly total: number
  /** The file being imported, else the next one waiting; null once every file is finished. */
  readonly current: string | null
  readonly finished: boolean
}

export const importProgress = (_batch: ImportBatch): ImportProgress => {
  throw new Error("not implemented: IF")
}

/** The Learner's batches not yet dismissed. The only source of import state: a reload or a new sign-in reads it again. */
export const importsQuery = () =>
  queryOptions({
    queryKey: ["imports"],
    queryFn: (): Promise<ReadonlyArray<ImportBatch>> => Promise.reject(new Error("not implemented: IF"))
  })

export interface StartImport {
  readonly files: ReadonlyArray<File>
  readonly termLang: string
  readonly meaningLang: string
}

/** Uploads the batch. More than 20 files reject before any request. */
export const startImport = (_input: StartImport): Promise<ImportBatch> =>
  Promise.reject(new Error("not implemented: IF"))

export const dismissImport = (_batchSlug: ImportBatchSlug): Promise<void> =>
  Promise.reject(new Error("not implemented: IF"))

/** The part of the browser's `EventSource` the follower uses, so tests can pass a fake. */
export interface EventSourceLike {
  onmessage: ((event: { readonly data: string }) => void) | null
  onerror: ((event: unknown) => void) | null
  close(): void
}

export interface FollowImports {
  readonly queryClient: QueryClient
  /** Defaults to `new EventSource(url)`. */
  readonly open?: (url: string) => EventSourceLike
  /** Wait before reconnecting after the stream fails. */
  readonly retryMs?: number
}

/**
 * Keeps one event stream open while signed in: each event refetches the imports, and a finished batch the decks too.
 * A failed stream reconnects with a fresh ticket. Returns a function that closes it for good.
 */
export const followImports = (_options: FollowImports): (() => void) => {
  throw new Error("not implemented: IF")
}
