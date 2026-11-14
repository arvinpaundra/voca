/** Routes that need a session: the signed-in app. The landing page and the callback are for everyone. */
export const isAppPath = (_path: string): boolean => {
  throw new Error("not implemented: NAV")
}

/**
 * Where a route sends the browser before rendering, given whether a session exists (a refresh token is stored).
 * Null means "render this route".
 */
export const authRedirect = (path: string, signedIn: boolean): string | null => {
  if (signedIn && path === "/login") return "/dashboard"
  if (!signedIn && isAppPath(path)) return "/login"
  return null
}
