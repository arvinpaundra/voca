import { Effect, Layer } from "effect"
import { connectRetrying } from "../../../shared/beanstalk/client.ts"
import { ImportQueue } from "../../application/importsPorts.ts"
import type { ImportsOptions } from "../imports.ts"

const encoder = new TextEncoder()

/**
 * The producer's own connection: the worker's connection is held by its blocking `reserve`. Commands on one client run
 * one at a time, so the requests share this one.
 */
export const ImportQueueLive = (options: ImportsOptions) =>
  Layer.effect(
    ImportQueue,
    Effect.gen(function* () {
      const client = yield* connectRetrying(options, (fresh) => fresh.use(options.tube)).pipe(Effect.orDie)

      return ImportQueue.of({
        put: (fileId) => client.put(encoder.encode(fileId.toString())).pipe(Effect.asVoid, Effect.orDie)
      })
    })
  )
