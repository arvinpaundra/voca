import * as BunSocket from "@effect/platform-bun/BunSocket"
import { Data, Effect, Option, Semaphore } from "effect"
import type { NonEmptyReadonlyArray } from "effect/Array"
import type { Scope } from "effect"
import * as Socket from "effect/socket/Socket"

/** A beanstalkd reply the caller can act on (`NotFound`, `JobTooBig`, …) or a broken connection. */
export class BeanstalkError extends Data.TaggedError("BeanstalkError")<{
  readonly reason: "NotFound" | "JobTooBig" | "BadFormat" | "ConnectionClosed" | "Protocol"
  readonly message: string
}> {}

export interface Job {
  readonly id: number
  readonly body: Uint8Array
}

export interface PutOptions {
  readonly pri?: number
  readonly delay?: number // seconds
  readonly ttr?: number // seconds
}

/**
 * One connection to beanstalkd. Commands on one client run one at a time, in call order, so concurrent fibers can
 * share it. A blocking `reserve` holds the connection: a worker uses its own client.
 */
export interface BeanstalkClient {
  readonly use: (tube: string) => Effect.Effect<void, BeanstalkError>
  readonly watch: (tube: string) => Effect.Effect<void, BeanstalkError>
  readonly ignore: (tube: string) => Effect.Effect<void, BeanstalkError>
  readonly put: (body: Uint8Array, options?: PutOptions) => Effect.Effect<number, BeanstalkError>
  /** The next ready job of the watched tubes, or none once `timeoutSeconds` pass. */
  readonly reserve: (timeoutSeconds: number) => Effect.Effect<Option.Option<Job>, BeanstalkError>
  readonly delete: (id: number) => Effect.Effect<void, BeanstalkError>
  readonly bury: (id: number) => Effect.Effect<void, BeanstalkError>
}

type Reserved = Option.Option<Job> | "deadline-soon"

interface Reply {
  readonly status: string
  readonly args: ReadonlyArray<string>
}

const DEFAULT_PRIORITY = 1024
const DEFAULT_DELAY = 0
const DEFAULT_TTR = 60

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const CRLF = encoder.encode("\r\n")

const commandLine = (text: string) => encoder.encode(`${text}\r\n`)

const connectionClosed = () =>
  new BeanstalkError({
    reason: "ConnectionClosed",
    message: "beanstalkd connection closed"
  })

const failure = (reply: Reply) => {
  switch (reply.status) {
    case "NOT_FOUND":
      return new BeanstalkError({ reason: "NotFound", message: "beanstalkd: job not found" })

    case "JOB_TOO_BIG":
      return new BeanstalkError({ reason: "JobTooBig", message: "beanstalkd: job is over 64 KiB" })

    case "BAD_FORMAT":
    case "UNKNOWN_COMMAND":
    case "EXPECTED_CRLF":
      return new BeanstalkError({ reason: "BadFormat", message: `beanstalkd: ${reply.status}` })

    default:
      return new BeanstalkError({ reason: "Protocol", message: `beanstalkd: unexpected reply ${reply.status}` })
  }
}

const replyWith = (reply: Reply, ...statuses: ReadonlyArray<string>) =>
  statuses.includes(reply.status) ? Effect.succeed(reply) : Effect.fail(failure(reply))

const append = (buffer: Uint8Array, chunk: Uint8Array) => {
  const joined = new Uint8Array(buffer.length + chunk.length)

  joined.set(buffer)
  joined.set(chunk, buffer.length)

  return joined
}

/** Opens a connection; it closes with the scope. */
export const connect = (
  endpoint: { readonly host: string; readonly port: number }
): Effect.Effect<BeanstalkClient, BeanstalkError, Scope.Scope> =>
  Effect.gen(function* () {
    const socket = yield* BunSocket.makeNet({
      host: endpoint.host,
      port: endpoint.port,
      openTimeout: "5 seconds"
    })
    const pull = yield* Socket.readerBytes(socket).pipe(Effect.mapError(connectionClosed))
    const writer = yield* socket.writer
    const permit = yield* Semaphore.make(1)

    // Replies and bodies are framed by byte count, so the buffer holds bytes, not decoded text.
    let buffer = new Uint8Array(0)

    const fill = Effect.gen(function* () {
      const chunks = yield* pull.pipe(Effect.mapError(connectionClosed))

      for (const chunk of chunks) {
        buffer = append(buffer, chunk)
      }
    })

    const findCrlf = () => buffer.findIndex((byte, index) => byte === 13 && buffer[index + 1] === 10)

    const readLine = Effect.gen(function* () {
      let end = findCrlf()

      while (end < 0) {
        yield* fill
        end = findCrlf()
      }

      const line = decoder.decode(buffer.subarray(0, end))

      buffer = buffer.slice(end + 2)

      return line
    })

    const readBytes = (count: number) =>
      Effect.gen(function* () {
        while (buffer.length < count) {
          yield* fill
        }

        const bytes = buffer.slice(0, count)

        buffer = buffer.slice(count)

        return bytes
      })

    const readCrlf = Effect.gen(function* () {
      const bytes = yield* readBytes(2)

      if (bytes[0] !== 13 || bytes[1] !== 10) {
        return yield* Effect.fail(
          new BeanstalkError({ reason: "Protocol", message: "beanstalkd: body is not followed by CRLF" })
        )
      }
    })

    const readReply = readLine.pipe(
      Effect.map((line) => {
        const [status = "", ...args] = line.split(" ")

        return { status, args }
      })
    )

    /** One request and its reply, held under the permit so concurrent callers cannot swap replies. */
    const call = <A>(
      request: NonEmptyReadonlyArray<Uint8Array>,
      decode: (reply: Reply) => Effect.Effect<A, BeanstalkError>
    ) =>
      permit.withPermits(1)(
        Effect.gen(function* () {
          yield* writer.writeAll(request).pipe(Effect.mapError(connectionClosed))

          const reply = yield* readReply

          return yield* decode(reply)
        })
      )

    const use = (tube: string) =>
      call([commandLine(`use ${tube}`)], (reply) => replyWith(reply, "USING")).pipe(Effect.asVoid)

    const watch = (tube: string) =>
      call([commandLine(`watch ${tube}`)], (reply) => replyWith(reply, "WATCHING")).pipe(Effect.asVoid)

    const ignore = (tube: string) =>
      call([commandLine(`ignore ${tube}`)], (reply) => replyWith(reply, "WATCHING")).pipe(Effect.asVoid)

    const put = (body: Uint8Array, options: PutOptions = {}) => {
      const pri = options.pri ?? DEFAULT_PRIORITY
      const delay = options.delay ?? DEFAULT_DELAY
      const ttr = options.ttr ?? DEFAULT_TTR
      const header = commandLine(`put ${pri} ${delay} ${ttr} ${body.length}`)

      return call([header, body, CRLF], (reply) => replyWith(reply, "INSERTED", "BURIED")).pipe(
        Effect.map((reply) => Number(reply.args[0]))
      )
    }

    const reserveOnce = (timeoutSeconds: number) =>
      call<Reserved>([commandLine(`reserve-with-timeout ${timeoutSeconds}`)], (reply) =>
        Effect.gen(function* () {
          if (reply.status === "TIMED_OUT") {
            return Option.none()
          }

          if (reply.status === "DEADLINE_SOON") {
            return "deadline-soon"
          }

          yield* replyWith(reply, "RESERVED")

          const id = Number(reply.args[0])
          const body = yield* readBytes(Number(reply.args[1]))

          yield* readCrlf

          return Option.some({ id, body })
        })
      )

    const reserve = (timeoutSeconds: number): Effect.Effect<Option.Option<Job>, BeanstalkError> =>
      reserveOnce(timeoutSeconds).pipe(
        Effect.flatMap((result) => (result === "deadline-soon" ? reserve(timeoutSeconds) : Effect.succeed(result)))
      )

    const remove = (id: number) =>
      call([commandLine(`delete ${id}`)], (reply) => replyWith(reply, "DELETED")).pipe(Effect.asVoid)

    const bury = (id: number) =>
      call([commandLine(`bury ${id} ${DEFAULT_PRIORITY}`)], (reply) => replyWith(reply, "BURIED")).pipe(
        Effect.asVoid
      )

    return { use, watch, ignore, put, reserve, delete: remove, bury }
  })
