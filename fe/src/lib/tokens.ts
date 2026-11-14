export const REFRESH_KEY = "voca.refreshToken"

type TokenStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

const REFRESH_MARGIN_MS = 60_000

// Refresh token is persisted in the given storage; access token lives in this closure only.
export const createTokenStore = (storage: TokenStorage) => {
  let access: string | null = null
  let expiresAt = 0

  return {
    getRefresh: (): string | null => storage.getItem(REFRESH_KEY),
    setRefresh: (token: string): void => storage.setItem(REFRESH_KEY, token),
    getAccess: (): string | null => access,
    /** `expiresIn` is in seconds; `now` is epoch milliseconds. */
    setAccess: (token: string, expiresIn: number, now: number): void => {
      access = token
      expiresAt = now + expiresIn * 1000
    },
    /** True when there is no access token, or fewer than 60 s remain at `now` (epoch ms). */
    needsRefresh: (now: number): boolean => access === null || expiresAt - now < REFRESH_MARGIN_MS,
    clear: (): void => {
      storage.removeItem(REFRESH_KEY)
      access = null
      expiresAt = 0
    }
  }
}
