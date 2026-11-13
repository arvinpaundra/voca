// STUB written by the decision thread so the locked tests compile. The task replaces this file.
export const REFRESH_KEY = "voca.refreshToken"

type TokenStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

export const createTokenStore = (_storage: TokenStorage) => ({
  getRefresh: (): string | null => null,
  setRefresh: (_token: string): void => {},
  getAccess: (): string | null => null,
  /** `expiresIn` is in seconds; `now` is epoch milliseconds. */
  setAccess: (_token: string, _expiresIn: number, _now: number): void => {},
  /** True when there is no access token, or fewer than 60 s remain at `now` (epoch ms). */
  needsRefresh: (_now: number): boolean => true,
  clear: (): void => {}
})
