import { describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import { connect, type BeanstalkClient } from "../src/shared/beanstalk/client.ts"

const server = {
  host: process.env.TEST_BEANSTALKD_HOST ?? "127.0.0.1",
  port: Number(process.env.TEST_BEANSTALKD_PORT)
}

const text = (value: string) => new TextEncoder().encode(value)

let tubes = 0

/** A fresh client on a tube no other test uses, watching only that tube. */
const inTube = <A, E>(f: (client: BeanstalkClient) => Effect.Effect<A, E>) =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const client = yield* connect(server)
        const tube = `bq-${process.pid}-${tubes++}`

        yield* client.use(tube)
        yield* client.watch(tube)
        yield* client.ignore("default")

        return yield* f(client)
      })
    )
  )

describe("put and reserve", () => {
  test("a put job is reserved with its id and body", async () => {
    const result = await inTube((client) =>
      Effect.gen(function* () {
        const id = yield* client.put(text("hello"))
        const job = yield* client.reserve(5)

        return { id, job }
      })
    )

    expect(result.id).toBeGreaterThan(0)
    expect(Option.getOrThrow(result.job).id).toBe(result.id)
    expect(new TextDecoder().decode(Option.getOrThrow(result.job).body)).toBe("hello")
  })

  test("the oldest job is reserved first", async () => {
    const result = await inTube((client) =>
      Effect.gen(function* () {
        const first = yield* client.put(text("first"))
        yield* client.put(text("second"))
        const job = yield* client.reserve(5)

        return { first, job }
      })
    )

    expect(Option.getOrThrow(result.job).id).toBe(result.first)
  })

  test("reserve gives none when no job is ready in time", async () => {
    const job = await inTube((client) => client.reserve(1))

    expect(Option.isNone(job)).toBe(true)
  })

  test("a delayed job is not ready yet", async () => {
    const job = await inTube((client) =>
      Effect.gen(function* () {
        yield* client.put(text("later"), { pri: 5, delay: 30, ttr: 60 })

        return yield* client.reserve(0)
      })
    )

    expect(Option.isNone(job)).toBe(true)
  })

  test("a body over 64 KiB fails with JobTooBig", async () => {
    const error = await inTube((client) => Effect.flip(client.put(new Uint8Array(65_536 + 1))))

    expect(error.reason).toBe("JobTooBig")
  })

  test("other jobs in the default tube are not reserved", async () => {
    const job = await inTube((client) =>
      Effect.gen(function* () {
        yield* client.use("default")
        yield* client.put(text("elsewhere"))

        return yield* client.reserve(0)
      })
    )

    expect(Option.isNone(job)).toBe(true)
  })
})

describe("delete and bury", () => {
  test("a deleted job is gone", async () => {
    const error = await inTube((client) =>
      Effect.gen(function* () {
        yield* client.put(text("delete me"))
        const job = Option.getOrThrow(yield* client.reserve(5))
        yield* client.delete(job.id)

        return yield* Effect.flip(client.delete(job.id))
      })
    )

    expect(error.reason).toBe("NotFound")
  })

  test("deleting an unknown id fails with NotFound", async () => {
    const error = await inTube((client) => Effect.flip(client.delete(999_999_999)))

    expect(error.reason).toBe("NotFound")
  })

  test("a buried job is not reserved again", async () => {
    const again = await inTube((client) =>
      Effect.gen(function* () {
        yield* client.put(text("bury me"))
        const job = Option.getOrThrow(yield* client.reserve(5))
        yield* client.bury(job.id)

        return yield* client.reserve(0)
      })
    )

    expect(Option.isNone(again)).toBe(true)
  })
})

describe("framing", () => {
  test("a body with CRLF inside and a 60 KiB body arrive intact", async () => {
    const big = new Uint8Array(60 * 1024).map((_, i) => i % 251)

    const bodies = await inTube((client) =>
      Effect.gen(function* () {
        yield* client.put(text("line one\r\nline two\r\n"))
        yield* client.put(big)
        const first = Option.getOrThrow(yield* client.reserve(5))
        const second = Option.getOrThrow(yield* client.reserve(5))

        return [first.body, second.body]
      })
    )

    expect(new TextDecoder().decode(bodies[0])).toBe("line one\r\nline two\r\n")
    expect(bodies[1]).toEqual(big)
  })

  test("concurrent puts on one client each get their own id", async () => {
    const ids = await inTube((client) =>
      Effect.forEach(
        Array.from({ length: 20 }, (_, i) => i),
        (i) => client.put(text(`job ${i}`)),
        { concurrency: "unbounded" }
      )
    )

    expect(new Set(ids).size).toBe(20)
  })
})
