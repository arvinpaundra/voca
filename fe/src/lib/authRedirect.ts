/**
 * Where a route sends the browser before rendering, given whether a session exists (a refresh token is stored).
 * Null means "render this route". Not implemented yet: task FD.
 */
export const authRedirect = (_path: string, _signedIn: boolean): string | null => {
  return "not implemented"
}
