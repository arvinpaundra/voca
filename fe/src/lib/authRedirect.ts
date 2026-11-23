export const isAppPath = (path: string): boolean => {
  return path === "/app" || path.startsWith("/app/")
}

export const hasShell = (path: string): boolean => {
  if (!isAppPath(path)) return false
  if (path === "/app/study") return false

  return !/^\/app\/decks\/[^/]+\/study\/?$/.test(path)
}

export const authRedirect = (path: string, signedIn: boolean): string | null => {
  if (signedIn && path === "/login") return "/app"
  if (!signedIn && isAppPath(path)) return "/login"
  return null
}
