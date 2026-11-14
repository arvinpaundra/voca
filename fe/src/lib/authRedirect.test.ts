import { expect, test } from "bun:test"
import { authRedirect, isAppPath } from "./authRedirect.ts"

// Where each route sends the browser before rendering. The landing page is for everyone; the app is for the signed-in;
// the sign-in page is for the signed-out. App paths are also the pages that get the sidebar.

test.each([
  ["/", false, null],
  ["/", true, null],
  ["/login", false, null],
  ["/login", true, "/dashboard"],
  ["/dashboard", false, "/login"],
  ["/dashboard", true, null],
  ["/decks/TQ7KM2PV9X", false, "/login"],
  ["/decks/TQ7KM2PV9X", true, null],
  ["/decks/TQ7KM2PV9X/study", false, "/login"],
  ["/study", false, "/login"],
  ["/study", true, null],
  ["/auth/callback", false, null],
  ["/auth/callback", true, null]
] as const)("%s, signed in: %s → %s", (path, signedIn, expected) => {
  expect(authRedirect(path, signedIn)).toBe(expected)
})

test.each([
  ["/dashboard", true],
  ["/decks/TQ7KM2PV9X", true],
  ["/decks/TQ7KM2PV9X/study", true],
  ["/study", true],
  ["/", false],
  ["/login", false],
  ["/auth/callback", false],
  ["/studying", false],
  ["/dashboards", false]
] as const)("%s is an app path: %s", (path, expected) => {
  expect(isAppPath(path)).toBe(expected)
})
