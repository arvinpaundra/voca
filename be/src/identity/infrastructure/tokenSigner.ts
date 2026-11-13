import { Clock, Effect, Layer, Redacted, Schema } from "effect"
import { jwtVerify, SignJWT } from "jose"
import { LearnerSlug } from "@voca/contract"
import { InvalidToken, TokenSigner } from "../application/ports.ts"

const ACCESS_TOKEN_SECONDS = 15 * 60

export const TokenSignerLive = (secret: Redacted.Redacted<string>) => {
  const key = new TextEncoder().encode(Redacted.value(secret))

  return Layer.succeed(
    TokenSigner,
    TokenSigner.of({
      sign: (slug) =>
        Effect.gen(function* () {
          const issuedAt = Math.floor((yield* Clock.currentTimeMillis) / 1000)
          const token = yield* Effect.tryPromise(() =>
            new SignJWT({})
              .setProtectedHeader({ alg: "HS256" })
              .setSubject(slug)
              .setIssuer("voca")
              .setAudience("voca-web")
              .setIssuedAt(issuedAt)
              .setExpirationTime(issuedAt + ACCESS_TOKEN_SECONDS)
              .sign(key)
          ).pipe(Effect.orDie)
          return { token, expiresIn: ACCESS_TOKEN_SECONDS }
        }),

      verify: (token) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis
          const { payload } = yield* Effect.tryPromise(() =>
            jwtVerify(token, key, { algorithms: ["HS256"], issuer: "voca", audience: "voca-web", currentDate: new Date(now) })
          )
          return yield* Schema.decodeUnknownEffect(LearnerSlug)(payload.sub)
        }).pipe(Effect.mapError(() => new InvalidToken()))
    })
  )
}
