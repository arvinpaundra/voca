import { Clock, Effect, Layer, Redacted, Schema } from "effect"
import { AppConfig } from "../../shared/config.ts"
import { GoogleOAuth, GoogleSignInFailed } from "../application/ports.ts"
import { checkIdTokenClaims } from "../domain/auth.ts"

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"

const TokenResponse = Schema.Struct({ id_token: Schema.String })
const JsonText = Schema.fromJsonString(Schema.Unknown)

/** Google's token endpoint + ID-token checks. The ID token is read from the TLS response; no signature check. */
export const GoogleOAuthLive = Layer.effect(
  GoogleOAuth,
  Effect.gen(function* () {
    const { googleClientId, googleClientSecret } = yield* AppConfig

    return GoogleOAuth.of({
      exchange: ({ code, codeVerifier, redirectUri }) =>
        Effect.gen(function* () {
          const nowSeconds = Math.floor((yield* Clock.currentTimeMillis) / 1000)
          const form = new URLSearchParams({
            code,
            code_verifier: codeVerifier,
            redirect_uri: redirectUri,
            client_id: googleClientId,
            client_secret: Redacted.value(googleClientSecret),
            grant_type: "authorization_code"
          })
          const response = yield* Effect.tryPromise({
            try: () => fetch(TOKEN_ENDPOINT, { method: "POST", body: form }),
            catch: () => new GoogleSignInFailed({ reason: "token endpoint unreachable" })
          })
          if (!response.ok) return yield* new GoogleSignInFailed({ reason: `token endpoint answered ${response.status}` })
          const body = yield* Effect.tryPromise({
            try: () => response.json(),
            catch: () => new GoogleSignInFailed({ reason: "token endpoint sent no JSON" })
          })
          const { id_token: idToken } = yield* Schema.decodeUnknownEffect(TokenResponse)(body).pipe(
            Effect.mapError(() => new GoogleSignInFailed({ reason: "token response has no id_token" }))
          )
          const payload = idToken.split(".")[1] ?? ""
          const claims = yield* Effect.fromResult(Schema.decodeUnknownResult(JsonText)(Buffer.from(payload, "base64url").toString("utf8"))).pipe(
            Effect.mapError(() => new GoogleSignInFailed({ reason: "ID token payload is not JSON" }))
          )
          return yield* Effect.fromResult(checkIdTokenClaims(claims, { clientId: googleClientId, nowSeconds })).pipe(
            Effect.mapError((reason) => new GoogleSignInFailed({ reason }))
          )
        })
    })
  })
)
