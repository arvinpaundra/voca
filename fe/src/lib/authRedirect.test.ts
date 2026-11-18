import { expect, test } from "bun:test"
import { authRedirect, hasShell, isAppPath } from "./authRedirect.ts"

// Where each route sends the browser before rendering. The landing page is for everyone; the app is for the signed-in;
// the sign-in page is for the signed-out.

test.each([
  ["/", false, null],
  ["/", true, null],
  ["/login", false, null],
  ["/login", true, "/app"],
  ["/app", false, "/login"],
  ["/app", true, null],
  ["/app/decks", false, "/login"],
  ["/app/decks/TQ7KM2PV9X", false, "/login"],
  ["/app/decks/TQ7KM2PV9X", true, null],
  ["/app/decks/TQ7KM2PV9X/study", false, "/login"],
  ["/app/study", false, "/login"],
  ["/app/study", true, null],
  ["/app/discover", false, "/login"],
  ["/auth/callback", false, null],
  ["/auth/callback", true, null]
] as const)("%s, signed in: %s → %s", (path, signedIn, expected) => {
  expect(authRedirect(path, signedIn)).toBe(expected)
})

test.each([
  ["/app", true],
  ["/app/", true],
  ["/app/decks/TQ7KM2PV9X/study", true],
  ["/app/study", true],
  ["/", false],
  ["/login", false],
  ["/auth/callback", false],
  ["/apple", false],
  ["/dashboard", false]
] as const)("%s is an app path: %s", (path, expected) => {
  expect(isAppPath(path)).toBe(expected)
})

test.each([
  ["/app", true],
  ["/app/decks", true],
  ["/app/decks/TQ7KM2PV9X/study", false],
  ["/app/decks/TQ7KM2PV9X/words/AB12CD34EF56", true],
  ["/app/hard", true],
  ["/app/discover", true],
  ["/app/study", false],
  ["/login", false]
] as const)("%s has the sidebar: %s", (path, expected) => {
  expect(hasShell(path)).toBe(expected)
})
