import { Effect, type Result } from "effect"
import { FetchHttpClient, HttpClientRequest } from "effect/http"
import { HttpApiClient, HttpApiMiddleware } from "effect/http-api"
import { Authorization, VocaApi } from "@voca/contract"

// The reference for calling the API from the frontend: the typed client generated from
// `VocaApi`, so a request or response that doesn't match the contract fails to compile. Copy its use from api.test.ts.

export type ApiClient = HttpApiClient.ForApi<typeof VocaApi>

export interface ApiOptions {
  /** The current access token, or null. Sent as `Authorization: Bearer` on protected routes. */
  readonly getAccessToken: () => string | null
  /** Defaults to the page's origin: the API is same-origin under `/api`. */
  readonly baseUrl?: string
  /** Defaults to the global `fetch`; tests pass a fake. */
  readonly fetch?: typeof globalThis.fetch
}

/**
 * Runs one API call and never rejects: the result is `Success` with the value, or `Failure` with the contract's
 * typed error (`failure._tag` is e.g. "Unauthorized"). Network and decoding problems are failures too.
 *
 *   const result = await callApi(options, (client) => client.me.get())
 *   if (Result.isSuccess(result)) show(result.success)
 */
export const callApi = <A, E>(
  options: ApiOptions,
  call: (client: ApiClient) => Effect.Effect<A, E>
): Promise<Result.Result<A, E | unknown>> =>
  Effect.runPromise(
    HttpApiClient.make(VocaApi, { baseUrl: options.baseUrl ?? globalThis.location?.origin }).pipe(
      Effect.flatMap(call),
      Effect.provide(
        HttpApiMiddleware.layerClient(Authorization, ({ next, request }) => {
          const token = options.getAccessToken()
          return next(token === null ? request : HttpClientRequest.bearerToken(request, token))
        })
      ),
      Effect.provide(FetchHttpClient.layer),
      Effect.provideService(FetchHttpClient.Fetch, options.fetch ?? globalThis.fetch),
      Effect.result
    )
  )
