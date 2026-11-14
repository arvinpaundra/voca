import { expect, test } from "bun:test"
import { authRedirect } from "./authRedirect.ts"

// Where each route sends the browser before rendering. The landing page is for everyone; the app is for the signed-in;
// the sign-in page is for the signed-out.

test.each([
  ["/", false, null],
  ["/", true, null],
  ["/login", false, null],
  ["/login", true, "/dashboard"],
  ["/dashboard", false, "/login"],
  ["/dashboard", true, null],
  ["/decks/TQ7KM2PV9X", false, "/login"],
  ["/decks/TQ7KM2PV9X", true, null],
  ["/auth/callback", false, null],
  ["/auth/callback", true, null]
] as const)("%s, signed in: %s → %s", (path, signedIn, expected) => {
  expect(authRedirect(path, signedIn)).toBe(expected)
})
