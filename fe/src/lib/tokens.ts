export const REFRESH_KEY = "voca.refreshToken"
export const ACCESS_KEY = "voca.accessToken"
export const ACCESS_EXPIRES_KEY = "voca.accessExpiresAt"

type TokenStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

const REFRESH_MARGIN_MS = 60_000

export const createTokenStore = (storage: TokenStorage) => {
  const readExpiresAt = (): number | null => {
    const raw = storage.getItem(ACCESS_EXPIRES_KEY)
    if (raw === null) return null

    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  }

  return {
    getRefresh: (): string | null => storage.getItem(REFRESH_KEY),
    setRefresh: (token: string): void => storage.setItem(REFRESH_KEY, token),
    getAccess: (): string | null => storage.getItem(ACCESS_KEY),

    setAccess: (token: string, expiresIn: number, now: number): void => {
      storage.setItem(ACCESS_KEY, token)
      storage.setItem(ACCESS_EXPIRES_KEY, String(now + expiresIn * 1000))
    },

    needsRefresh: (now: number): boolean => {
      if (storage.getItem(ACCESS_KEY) === null) return true

      const expiresAt = readExpiresAt()
      if (expiresAt === null) return true

      return expiresAt - now < REFRESH_MARGIN_MS
    },

    clear: (): void => {
      storage.removeItem(REFRESH_KEY)
      storage.removeItem(ACCESS_KEY)
      storage.removeItem(ACCESS_EXPIRES_KEY)
    }
  }
}
