import { queryOptions, type QueryClient } from "@tanstack/react-query"
import { Result } from "effect"
import { IMPORT_MAX_FILES, type ImportBatch, type ImportBatchSlug, type ImportEvent, type ImportStreamEvent } from "@voca/contract"
import { session } from "./appSession.ts"
import { orReject } from "./queryClient.ts"

// Importing several decks (FR-29): start a batch, read the batches, and follow their progress live over SSE.

export interface ImportProgress {
  /** Files finished, imported or failed. */
  readonly done: number
  readonly total: number
  /** The file being imported, else the next one waiting; null once every file is finished. */
  readonly current: string | null
  readonly finished: boolean
}

const isFinished = (status: ImportBatch["files"][number]["status"]): boolean =>
  status === "done" || status === "failed"

export const importProgress = (batch: ImportBatch): ImportProgress => {
  const done = batch.files.filter((file) => isFinished(file.status)).length
  const running = batch.files.find((file) => file.status === "running")
  const waiting = batch.files.find((file) => file.status === "pending")

  return {
    done,
    total: batch.files.length,
    current: (running ?? waiting)?.name ?? null,
    finished: done === batch.files.length
  }
}

/** The Learner's batches not yet dismissed. The only source of import state: a reload or a new sign-in reads it again. */
export const importsQuery = () =>
  queryOptions({
    queryKey: ["imports"],
    queryFn: (): Promise<ReadonlyArray<ImportBatch>> =>
      orReject(session.call((client) => client.imports.listImports()))
  })

export interface StartImport {
  readonly files: ReadonlyArray<File>
  readonly termLang: string
  readonly meaningLang: string
}

/** Uploads the batch. More than 50 files reject before any request. */
export const startImport = ({ files, termLang, meaningLang }: StartImport): Promise<ImportBatch> => {
  if (files.length > IMPORT_MAX_FILES) {
    return Promise.reject(new Error(`An import takes at most ${IMPORT_MAX_FILES} files`))
  }

  const payload = new FormData()

  payload.append("termLang", termLang)
  payload.append("meaningLang", meaningLang)

  for (const file of files) {
    payload.append("files", file)
  }

  return orReject(session.call((client) => client.imports.importDecks({ payload })))
}

export const dismissImport = (batchSlug: ImportBatchSlug): Promise<void> =>
  orReject(session.call((client) => client.imports.dismissImport({ params: { batchSlug } }))).then(() => undefined)

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

const openBrowserStream = (url: string): EventSourceLike => new EventSource(url) as unknown as EventSourceLike

/**
 * Keeps one event stream open while signed in: each event refetches the imports, and a finished batch the decks too.
 * A failed stream reconnects with a fresh ticket. Returns a function that closes it for good.
 */
export const followImports = ({
  queryClient,
  open = openBrowserStream,
  retryMs = 3000
}: FollowImports): (() => void) => {
  let stopped = false
  let source: EventSourceLike | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  const refetch = (event: ImportEvent) => {
    void queryClient.invalidateQueries({ queryKey: ["imports"] })

    if (event.status === "finished") {
      void queryClient.invalidateQueries({ queryKey: ["library", "decks"] })
    }
  }

  const scheduleReconnect = () => {
    if (stopped) return

    retryTimer = setTimeout(() => {
      retryTimer = null
      void connect()
    }, retryMs)
  }

  // A ticket is single use, so every connection asks for a new one.
  const connect = async (): Promise<void> => {
    const ticket = await session.call((client) => client.imports.importEventsTicket())

    if (stopped) return

    if (Result.isFailure(ticket)) {
      scheduleReconnect()
      return
    }

    const url = `/api/imports/events?ticket=${encodeURIComponent(ticket.success.ticket)}`
    const stream = open(url)

    source = stream

    stream.onmessage = (message) => {
      const event = JSON.parse(message.data) as ImportStreamEvent

      // The server's keep-alive: it only stops proxies from closing an idle stream, so it carries no batch change.
      if (event.status === "ping") return

      refetch(event)
    }

    stream.onerror = () => {
      stream.close()

      if (source === stream) source = null

      scheduleReconnect()
    }
  }

  void connect()

  return () => {
    stopped = true

    if (retryTimer !== null) clearTimeout(retryTimer)

    source?.close()
    source = null
  }
}
