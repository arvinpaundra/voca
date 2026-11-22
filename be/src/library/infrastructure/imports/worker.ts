import { Effect, Option, Schema } from "effect"
import { connectRetrying } from "../../../shared/beanstalk/client.ts"
import type { BeanstalkClient, Job } from "../../../shared/beanstalk/client.ts"
import { importFile } from "../../application/importsWorker.ts"
import type { ImportsOptions } from "../imports.ts"

// The wait is beanstalkd's own timeout: the loop never sleeps on a clock, so a TestClock can't stall it.
const RESERVE_SECONDS = 1

const decoder = new TextDecoder()

const fileIdOf = (job: Job): Effect.Effect<bigint> => {
  return Option.match(Schema.decodeUnknownOption(Schema.BigIntFromString)(decoder.decode(job.body)), {
    onNone: () => Effect.die("import job body is not a file id"),
    onSome: Effect.succeed
  })
}

/**
 * Takes the jobs one at a time, in the order beanstalkd gives them. A finished import deletes its job; a defect buries
 * it, so it stays visible instead of looping. A job that can't be settled is logged and the loop goes on. The loop
 * ends only when the connection itself fails: retrying a dead connection would spin, so it is logged and the worker
 * stops until the process restarts.
 */
export const runWorker = (options: ImportsOptions) => {
  return Effect.gen(function* () {
    const watchOnly = (fresh: BeanstalkClient) => Effect.andThen(fresh.watch(options.tube), fresh.ignore("default"))
    const client = yield* connectRetrying(options, watchOnly).pipe(Effect.orDie)

    const settle = (job: Job) => {
      return fileIdOf(job).pipe(
        Effect.flatMap(importFile),
        Effect.matchCauseEffect({
          onFailure: () => client.bury(job.id),
          onSuccess: () => client.delete(job.id)
        }),
        Effect.catchCause((cause) => Effect.logError(`import job ${job.id} not settled`, cause))
      )
    }

    return yield* Effect.gen(function* () {
      const next = yield* client.reserve(RESERVE_SECONDS)

      if (Option.isSome(next)) {
        yield* settle(next.value)
      }
    }).pipe(
      Effect.forever,
      Effect.catchCause((cause) => Effect.logError("import worker stopped", cause))
    )
  })
}
