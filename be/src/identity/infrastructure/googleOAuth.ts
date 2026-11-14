import { Effect, Layer } from "effect"
import { GoogleOAuth } from "../application/ports.ts"

/** Google's token endpoint + ID-token checks (docs/08). Not implemented yet: task B2. */
export const GoogleOAuthLive = Layer.succeed(GoogleOAuth, GoogleOAuth.of({ exchange: () => Effect.die("not implemented") }))
