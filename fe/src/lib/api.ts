import { Effect, type Result } from "effect"
import { FetchHttpClient, HttpClientRequest } from "effect/http"
import { HttpApiClient, HttpApiMiddleware } from "effect/http-api"
import { Authorization, VocaApi } from "@voca/contract"

export type ApiClient = HttpApiClient.ForApi<typeof VocaApi>

export interface ApiOptions {
  readonly getAccessToken: () => string | null
  readonly baseUrl?: string
  readonly fetch?: typeof globalThis.fetch
}

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
