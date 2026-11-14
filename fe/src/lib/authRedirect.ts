/** Routes that need a session: the signed-in app under `/app`. The landing page and the callback are for everyone. */
export const isAppPath = (path: string): boolean => {
  return path === "/app" || path.startsWith("/app/");
}

/** App pages framed by the sidebar. A study session takes the whole screen. */
export const hasShell = (path: string): boolean => {
  return isAppPath(path) && path !== "/app/study";
}

/**
 * Where a route sends the browser before rendering, given whether a session exists (a refresh token is stored).
 * Null means "render this route".
 */
export const authRedirect = (path: string, signedIn: boolean): string | null => {
  if (signedIn && path === "/login") return "/app"
  if (!signedIn && isAppPath(path)) return "/login"
  return null
}
