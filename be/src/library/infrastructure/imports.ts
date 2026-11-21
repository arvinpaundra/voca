import { Effect, Layer } from "effect"

/** Where the import jobs go: one tube per environment (tests use one per file). */
export interface ImportsOptions {
  readonly host: string
  readonly port: number
  readonly tube: string
}

/**
 * Everything the imports endpoints stand on: the batch store, the beanstalkd producer, the event PubSub, the stream
 * tickets, and the worker fiber that imports each file.
 */
export const ImportsLive = (_options: ImportsOptions): Layer.Layer<never> =>
  Layer.effectDiscard(Effect.die("not implemented: IB"))
