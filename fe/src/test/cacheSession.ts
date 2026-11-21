// A fake session for cache tests. A page seeded through `lib/queries.ts` must render from the cache, so a read
// before any write is unfinished work: `expectNoReads` fails with the task's marker. Writes, and the reads they
// trigger by invalidating the cache, are answered from `answers` and recorded by endpoint name ("library.getDeck").
import { spyOn } from "bun:test"
import { act } from "@testing-library/react"
import { Effect, Result } from "effect"
import type { ApiClient } from "../lib/api"
import { session } from "../lib/appSession"

export type Answers = Record<string, (request: any) => unknown>

export const cacheSession = (task: string, answers: Answers = {}) => {
  const calls: Array<string> = []

  const client = new Proxy(
    {},
    {
      get: (_, context) =>
        new Proxy(
          {},
          {
            get: (_, name) => (request: unknown) => {
              const endpoint = `${String(context)}.${String(name)}`
              calls.push(endpoint)

              const answer = answers[endpoint]
              if (answer === undefined) return Effect.die(`not implemented: ${task}: no answer for ${endpoint}`)

              return Effect.succeed(answer(request) as never)
            }
          }
        )
    }
  )

  const spy = spyOn(session, "call").mockImplementation(async (f) =>
    Result.succeed(await Effect.runPromise(f(client as unknown as ApiClient)))
  )

  // Lets the effects of the first render run, then checks that none of them went to the API.
  const expectNoReads = async (page: string) => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    if (calls.length > 0) throw new Error(`not implemented: ${task}: ${page} read ${calls.join(", ")} from the API instead of the cache`)
  }

  return { calls, expectNoReads, restore: () => spy.mockRestore() }
}
