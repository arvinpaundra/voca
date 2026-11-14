import { Layer, type Redacted } from "effect"
import type { HttpRouter } from "effect/http"

/**
 * The whole API as one layer: `VocaApi` with every group's handlers, the Authorization middleware and the identity
 * infrastructure. It still needs a `SqlClient` and a `GoogleOAuth` (main.ts gives the real ones, tests stubs).
 * Not implemented yet: task B1.
 */
export const makeApiLayer = (_options: { readonly jwtSecret: Redacted.Redacted<string> }) =>
  Layer.empty as Layer.Layer<never, never, HttpRouter.HttpRouter>
