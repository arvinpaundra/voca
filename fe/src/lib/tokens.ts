export const REFRESH_KEY = "voca.refreshToken"
export const ACCESS_KEY = "voca.accessToken"
export const ACCESS_EXPIRES_KEY = "voca.accessExpiresAt"

type TokenStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

const REFRESH_MARGIN_MS = 60_000

// Both tokens persist in the given storage, so a reload and every other tab reuse them.
export const createTokenStore = (storage: TokenStorage) => {
  return {
    getRefresh: (): string | null => storage.getItem(REFRESH_KEY),
    setRefresh: (token: string): void => storage.setItem(REFRESH_KEY, token),
    getAccess: (): string | null => {
      throw new Error("not implemented: SR")
    },
    /** `expiresIn` is in seconds; `now` is epoch milliseconds. */
    setAccess: (_token: string, _expiresIn: number, _now: number): void => {
      throw new Error("not implemented: SR")
    },
    /** True when there is no access token, its expiry is unreadable, or fewer than 60 s remain at `now` (epoch ms). */
    needsRefresh: (_now: number): boolean => {
      throw new Error(`not implemented: SR (margin ${REFRESH_MARGIN_MS} ms)`)
    },
    clear: (): void => {
      storage.removeItem(REFRESH_KEY)
    }
  }
}
