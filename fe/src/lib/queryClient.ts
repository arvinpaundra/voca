import { QueryClient } from "@tanstack/react-query"
import { Result } from "effect"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: false },
    mutations: { retry: false }
  }
})

export const orReject = <A, E>(call: Promise<Result.Result<A, E>>): Promise<A> =>
  call.then((result) => (Result.isSuccess(result) ? result.success : Promise.reject(result.failure)))
