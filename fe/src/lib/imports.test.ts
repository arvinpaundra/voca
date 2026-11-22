import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { DateTime, Effect, Result } from "effect"
import type { ImportBatch, ImportBatchSlug, ImportFile } from "@voca/contract"
import type { ApiClient } from "./api"
import { session } from "./appSession"
import { dismissImport, followImports, importProgress, importsQuery, startImport, type EventSourceLike } from "./imports"
import { queryClient } from "./queryClient"

const BATCH = "BATCH00000000001" as ImportBatchSlug

const file = (name: string, status: ImportFile["status"]): ImportFile => ({
  name,
  status,
  deck: null,
  imported: 0,
  skippedDuplicates: 0,
  errors: [],
  totalErrors: 0
})

const batchOf = (files: ReadonlyArray<ImportFile>): ImportBatch => ({
  slug: BATCH,
  termLang: "ja",
  meaningLang: "en",
  createdAt: DateTime.makeUnsafe("2026-11-22T00:00:00Z"),
  files
})

// A fake client: every imports endpoint records its request and answers what the test set.
const fakeSession = (answers: { tickets?: ReadonlyArray<string>; batch?: ImportBatch } = {}) => {
  const calls: Array<{ endpoint: string; request: unknown }> = []
  const tickets = [...(answers.tickets ?? ["T1"])]

  const record = (endpoint: string, answer: () => unknown) => (request?: unknown) => {
    calls.push({ endpoint, request })

    return Effect.succeed(answer() as never)
  }

  const client = {
    imports: {
      importDecks: record("importDecks", () => answers.batch ?? batchOf([])),
      listImports: record("listImports", () => [answers.batch ?? batchOf([])]),
      dismissImport: record("dismissImport", () => undefined),
      importEventsTicket: record("importEventsTicket", () => ({ ticket: tickets.shift() ?? "LAST" }))
    }
  }

  const spy = spyOn(session, "call").mockImplementation(async (f) =>
    Result.succeed(await Effect.runPromise(f(client as unknown as ApiClient)))
  )
  restore.push(() => spy.mockRestore())

  return calls
}

// A fake EventSource per open: the test drives its messages and failures.
const fakeStreams = () => {
  const opened: Array<{ url: string; source: EventSourceLike; closed: boolean }> = []

  const open = (url: string): EventSourceLike => {
    const entry = { url, closed: false, source: null as unknown as EventSourceLike }

    entry.source = {
      onmessage: null,
      onerror: null,
      close: () => {
        entry.closed = true
      }
    }
    opened.push(entry)

    return entry.source
  }

  return { opened, open }
}

const csv = (name: string) => new File(["term,meaning\n"], name, { type: "text/csv" })

const settle = () => Bun.sleep(20)

const restore: Array<() => void> = []

afterEach(() => {
  for (const undo of restore.splice(0)) undo()
})

describe("importProgress", () => {
  test("counts imported and failed files as done and names the running file", () => {
    const progress = importProgress(batchOf([
      file("a.csv", "done"),
      file("b.csv", "failed"),
      file("c.csv", "running"),
      file("d.csv", "pending"),
      file("e.csv", "pending")
    ]))

    expect(progress).toEqual({ done: 2, total: 5, current: "c.csv", finished: false })
  })

  test("before the worker picks a file up, the current file is the first one waiting", () => {
    const progress = importProgress(batchOf([file("a.csv", "done"), file("b.csv", "pending"), file("c.csv", "pending")]))

    expect(progress).toEqual({ done: 1, total: 3, current: "b.csv", finished: false })
  })

  test("a batch with every file finished has no current file", () => {
    const progress = importProgress(batchOf([file("a.csv", "done"), file("b.csv", "failed")]))

    expect(progress).toEqual({ done: 2, total: 2, current: null, finished: true })
  })
})

describe("startImport", () => {
  test("more than 50 files reject before any request", async () => {
    const calls = fakeSession()
    const files = Array.from({ length: 51 }, (_, i) => csv(`deck ${i}.csv`))

    const outcome = await startImport({ files, termLang: "ja", meaningLang: "en" }).then(
      () => "resolved",
      () => "rejected"
    )

    expect(outcome).toBe("rejected")
    expect(calls).toEqual([])
  })

  test("sends both languages and every file in one request, and resolves with the batch", async () => {
    const batch = batchOf([file("N5 verbs.csv", "pending"), file("N5 nouns.csv", "pending")])
    const calls = fakeSession({ batch })

    const started = await startImport({
      files: [csv("N5 verbs.csv"), csv("N5 nouns.csv")],
      termLang: "ja",
      meaningLang: "en"
    })

    expect(started).toEqual(batch)
    expect(calls.map((call) => call.endpoint)).toEqual(["importDecks"])

    const payload = (calls[0]!.request as { payload: FormData }).payload
    expect(payload.get("termLang")).toBe("ja")
    expect(payload.get("meaningLang")).toBe("en")
    expect(payload.getAll("files").map((part) => (part as File).name)).toEqual(["N5 verbs.csv", "N5 nouns.csv"])
  })
})

describe("reading and dismissing", () => {
  test("the imports query lists the batches under one key", async () => {
    const batch = batchOf([file("a.csv", "running")])
    const calls = fakeSession({ batch })
    const options = importsQuery()

    expect([...options.queryKey]).toEqual(["imports"])
    expect(await queryClient.fetchQuery(options)).toEqual([batch])
    expect(calls.map((call) => call.endpoint)).toEqual(["listImports"])
    queryClient.removeQueries({ queryKey: ["imports"] })
  })

  test("dismissing sends the batch slug", async () => {
    const calls = fakeSession()

    await dismissImport(BATCH)

    expect(calls).toEqual([{ endpoint: "dismissImport", request: { params: { batchSlug: BATCH } } }])
  })
})

describe("followImports", () => {
  const invalidations = () => {
    const keys: Array<unknown> = []
    const spy = spyOn(queryClient, "invalidateQueries").mockImplementation(async (filters) => {
      keys.push(filters?.queryKey)
    })
    restore.push(() => spy.mockRestore())

    return keys
  }

  test("opens the stream with a ticket and refetches the imports on every event", async () => {
    fakeSession({ tickets: ["T/1+"] })
    const keys = invalidations()
    const streams = fakeStreams()

    const stop = followImports({ queryClient, open: streams.open, retryMs: 1 })
    await settle()

    expect(streams.opened.map((entry) => entry.url)).toEqual(["/api/imports/events?ticket=T%2F1%2B"])

    streams.opened[0]!.source.onmessage?.({ data: JSON.stringify({ batch: BATCH, status: "running" }) })
    await settle()

    expect(keys).toEqual([["imports"]])
    stop()
  })

  test("a ping, the server's keep-alive, refetches nothing", async () => {
    fakeSession()
    const keys = invalidations()
    const streams = fakeStreams()

    const stop = followImports({ queryClient, open: streams.open, retryMs: 1 })
    await settle()
    streams.opened[0]!.source.onmessage?.({ data: JSON.stringify({ status: "ping" }) })
    await settle()

    expect(keys).toEqual([])

    streams.opened[0]!.source.onmessage?.({ data: JSON.stringify({ batch: BATCH, status: "running" }) })
    await settle()

    expect(keys).toEqual([["imports"]])
    stop()
  })

  test("a finished batch refetches the decks as well", async () => {
    fakeSession()
    const keys = invalidations()
    const streams = fakeStreams()

    const stop = followImports({ queryClient, open: streams.open, retryMs: 1 })
    await settle()
    streams.opened[0]!.source.onmessage?.({ data: JSON.stringify({ batch: BATCH, status: "finished" }) })
    await settle()

    expect(keys).toContainEqual(["imports"])
    expect(keys).toContainEqual(["library", "decks"])
    stop()
  })

  test("a failed stream closes and reconnects with a fresh ticket", async () => {
    const calls = fakeSession({ tickets: ["T1", "T2"] })
    invalidations()
    const streams = fakeStreams()

    const stop = followImports({ queryClient, open: streams.open, retryMs: 1 })
    await settle()
    streams.opened[0]!.source.onerror?.(new Event("error"))
    await settle()

    expect(streams.opened[0]!.closed).toBe(true)
    expect(streams.opened.map((entry) => entry.url)).toEqual([
      "/api/imports/events?ticket=T1",
      "/api/imports/events?ticket=T2"
    ])
    expect(calls.filter((call) => call.endpoint === "importEventsTicket")).toHaveLength(2)
    stop()
  })

  test("stopping closes the stream and never reconnects", async () => {
    fakeSession()
    invalidations()
    const streams = fakeStreams()

    const stop = followImports({ queryClient, open: streams.open, retryMs: 1 })
    await settle()
    stop()
    streams.opened[0]!.source.onerror?.(new Event("error"))
    await settle()

    expect(streams.opened[0]!.closed).toBe(true)
    expect(streams.opened).toHaveLength(1)
  })
})
