import { QueryClient } from "@tanstack/react-query"
import { Result } from "effect"

// The one query cache of the app. Components pass it to `useQuery` and `useMutation` as the second argument,
// so neither the app nor a test needs a provider.
export const queryClient = new QueryClient({
  defaultOptions: {
    // The session already refreshes the token and retries a 401 once; a second retry layer only delays the error.
    queries: { staleTime: 30_000, retry: false },
    mutations: { retry: false }
  }
})

/** A session call as a query or mutation function: the success value, or a rejection that becomes the query's error. */
export const orReject = <A, E>(call: Promise<Result.Result<A, E>>): Promise<A> =>
  call.then((result) => (Result.isSuccess(result) ? result.success : Promise.reject(result.failure)))
