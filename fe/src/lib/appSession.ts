import { createSession } from "./session.ts"
import { createTokenStore } from "./tokens.ts"

// The one token store and session of the app: every page reads and writes tokens through these.
export const tokenStore = createTokenStore(localStorage)

export const session = createSession({
  store: tokenStore,
  lock: (name, fn) => navigator.locks.request(name, fn),
  now: Date.now,
  onSignedOut: () => window.location.assign("/login")
})
