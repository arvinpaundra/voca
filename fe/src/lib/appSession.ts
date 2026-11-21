import { queryClient } from "./queryClient.ts"
import { createSession } from "./session.ts"
import { createTokenStore } from "./tokens.ts"

// The one token store and session of the app: every page reads and writes tokens through these.
export const tokenStore = createTokenStore(localStorage)

// Sign-out and a refused token refresh both end here. Clearing the cache first means the next Learner on this
// device never sees the previous one's data, even before the page reloads.
export const signedOut = (): void => {
  queryClient.clear()
  window.location.assign("/login")
}

export const session = createSession({
  store: tokenStore,
  lock: (name, fn) => navigator.locks.request(name, fn),
  now: Date.now,
  onSignedOut: signedOut
})
