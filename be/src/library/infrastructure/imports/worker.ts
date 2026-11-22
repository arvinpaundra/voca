import { Effect, Option, Result, Schema } from "effect"
import { connectRetrying } from "../../../shared/beanstalk/client.ts"
import type { BeanstalkClient, Job } from "../../../shared/beanstalk/client.ts"
import { importFile } from "../../application/importsWorker.ts"
import type { ImportsOptions } from "../imports.ts"

const RESERVE_SECONDS = 1

// Keeps a beanstalkd that is down from taking a hot loop of reserve attempts.
const RETRY_DELAY = "1 second"

const decoder = new TextDecoder()

const fileIdOf = (job: Job): Effect.Effect<bigint> => {
  return Option.match(Schema.decodeUnknownOption(Schema.BigIntFromString)(decoder.decode(job.body)), {
    onNone: () => Effect.die("import job body is not a file id"),
    onSome: Effect.succeed
  })
}

/**
 * Takes the jobs one at a time, in the order beanstalkd gives them. A finished import deletes its job; a defect buries
 * it, so it stays visible instead of looping. A job that can't be settled is logged and the loop goes on. A failed
 * reserve is logged and retried after a short pause, so the worker picks up again once beanstalkd is back.
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

    const takeOne = Effect.gen(function* () {
      const reserved = yield* Effect.result(client.reserve(RESERVE_SECONDS))

      if (Result.isFailure(reserved)) {
        yield* Effect.logError("import worker could not reserve a job, retrying", reserved.failure)

        yield* Effect.sleep(RETRY_DELAY)

        return
      }

      if (Option.isSome(reserved.success)) {
        yield* settle(reserved.success.value)
      }
    })

    return yield* Effect.forever(takeOne)
  })
}
