import { queryOptions, type QueryClient } from "@tanstack/react-query"
import { Result } from "effect"
import { IMPORT_MAX_FILES, type ImportBatch, type ImportBatchSlug, type ImportEvent, type ImportStreamEvent } from "@voca/contract"
import { session } from "./appSession.ts"
import { orReject } from "./queryClient.ts"

export interface ImportProgress {
  readonly done: number
  readonly total: number
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

export interface EventSourceLike {
  onmessage: ((event: { readonly data: string }) => void) | null
  onerror: ((event: unknown) => void) | null
  close(): void
}

export interface FollowImports {
  readonly queryClient: QueryClient
  readonly open?: (url: string) => EventSourceLike
  readonly retryMs?: number
}

const openBrowserStream = (url: string): EventSourceLike => new EventSource(url) as unknown as EventSourceLike

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
