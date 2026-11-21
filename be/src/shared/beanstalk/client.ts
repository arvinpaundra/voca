import { Data, Effect } from "effect"
import type { Option } from "effect"
import type { Scope } from "effect"

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

/** Opens a connection; it closes with the scope. */
export const connect = (
  _options: { readonly host: string; readonly port: number }
): Effect.Effect<BeanstalkClient, BeanstalkError, Scope.Scope> => Effect.die("not implemented: BQ")

