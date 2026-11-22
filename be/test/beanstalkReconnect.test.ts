import { afterAll, describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import type { Scope } from "effect"
import { connect, connectRetrying, type BeanstalkClient } from "../src/shared/beanstalk/client.ts"
import { makeBeanstalkProxy } from "./beanstalkProxy.ts"

// A client that survives beanstalkd dropping its connections, reached through a proxy the test can cut. A dropped
// connection may only show as a missed deadline (5 s), so these tests run longer than the default.

const SLOW = 20_000

const server = {
  host: process.env.TEST_BEANSTALKD_HOST ?? "127.0.0.1",
  port: Number(process.env.TEST_BEANSTALKD_PORT)
}

const proxy = makeBeanstalkProxy()
afterAll(() => proxy.stop())

const text = (value: string) => new TextEncoder().encode(value)
const decoded = (job: Option.Option<{ readonly body: Uint8Array }>) =>
  Option.match(job, { onNone: () => null, onSome: (j) => new TextDecoder().decode(j.body) })

let tubes = 0
const nextTube = () => `br-${process.pid}-${tubes++}`

const run = <A, E>(effect: Effect.Effect<A, E, Scope.Scope>) => Effect.runPromise(Effect.scoped(effect))

const watching = (tube: string) => (client: BeanstalkClient) =>
  Effect.andThen(client.watch(tube), client.ignore("default"))

/** The bodies waiting in a tube, read straight from beanstalkd, oldest first. */
const bodiesIn = (tube: string, count: number) =>
  Effect.gen(function* () {
    const reader = yield* connect(server)

    yield* watching(tube)(reader)

    const bodies: Array<string | null> = []

    for (let i = 0; i < count; i++) {
      bodies.push(decoded(yield* reader.reserve(2)))
    }

    return bodies
  })

describe("connectRetrying", () => {
  test("the first connection fails fast when nothing listens", async () => {
    const error = await run(Effect.flip(connectRetrying({ host: "127.0.0.1", port: 1 }, () => Effect.void)))

    expect(error.reason).toBe("ConnectionClosed")
  }, SLOW)

  test("setup runs on the first connection", async () => {
    const tube = nextTube()

    const bodies = await run(
      Effect.gen(function* () {
        const producer = yield* connectRetrying(proxy.endpoint, (client) => client.use(tube))

        yield* producer.put(text("first"))

        return yield* bodiesIn(tube, 1)
      })
    )

    expect(bodies).toEqual(["first"])
  }, SLOW)

  test("a put after the connection drops reopens it and still goes to the tube setup chose", async () => {
    const tube = nextTube()

    const bodies = await run(
      Effect.gen(function* () {
        const producer = yield* connectRetrying(proxy.endpoint, (client) => client.use(tube))

        yield* producer.put(text("before"))
        yield* Effect.promise(() => proxy.drop())
        yield* producer.put(text("after"))

        return yield* bodiesIn(tube, 2)
      })
    )

    expect(bodies).toEqual(["before", "after"])
  }, SLOW)

  test("while nothing listens a put fails, and the next put once it is back succeeds", async () => {
    const tube = nextTube()

    const result = await run(
      Effect.gen(function* () {
        const producer = yield* connectRetrying(proxy.endpoint, (client) => client.use(tube))

        yield* producer.put(text("before"))
        yield* Effect.promise(() => proxy.stop())

        const down = yield* Effect.flip(producer.put(text("lost")))

        proxy.listen()

        yield* producer.put(text("back"))

        return { reason: down.reason, bodies: yield* bodiesIn(tube, 2) }
      })
    )

    expect(result.reason).toBe("ConnectionClosed")
    expect(result.bodies).toEqual(["before", "back"])
  }, SLOW)

  test("a reserve after the connection drops reopens it, watches again and gets the next job", async () => {
    const tube = nextTube()

    const result = await run(
      Effect.gen(function* () {
        const worker = yield* connectRetrying(proxy.endpoint, watching(tube))
        const idle = yield* worker.reserve(0)

        yield* Effect.promise(() => proxy.drop())

        const producer = yield* connect(server)

        yield* producer.use(tube)
        yield* producer.put(text("job"))

        return { idle: decoded(idle), next: decoded(yield* worker.reserve(2)) }
      })
    )

    expect(result).toEqual({ idle: null, next: "job" })
  }, SLOW)
})
