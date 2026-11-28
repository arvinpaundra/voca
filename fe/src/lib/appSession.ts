import { queryClient } from "./queryClient.ts"
import { createSession } from "./session.ts"
import { createTokenStore } from "./tokens.ts"

export const tokenStore = createTokenStore(localStorage)

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
