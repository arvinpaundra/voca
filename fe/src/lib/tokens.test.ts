import { describe, expect, test } from "bun:test"
import { ACCESS_EXPIRES_KEY, ACCESS_KEY, REFRESH_KEY, createTokenStore } from "./tokens.ts"

// Both tokens persist in localStorage, the access token with its expiry,
// proactive refresh when `exp − now < 60 s`. The store takes its storage as an argument so it can be tested.
const memoryStorage = () => {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k)
  }
}

describe("refresh token (persisted)", () => {
  test("is stored under voca.refreshToken", () => {
    const storage = memoryStorage()
    const store = createTokenStore(storage)
    expect(REFRESH_KEY).toBe("voca.refreshToken")
    expect(store.getRefresh()).toBeNull()
    store.setRefresh("r1")
    expect(storage.data.get("voca.refreshToken")).toBe("r1")
    expect(store.getRefresh()).toBe("r1")
  })

  test("a second store over the same storage sees it (another tab)", () => {
    const storage = memoryStorage()
    createTokenStore(storage).setRefresh("r1")
    expect(createTokenStore(storage).getRefresh()).toBe("r1")
  })
})

describe("access token (persisted)", () => {
  test("is stored with its expiry, and a reloaded store sees it", () => {
    const storage = memoryStorage()
    const store = createTokenStore(storage)
    expect(store.getAccess()).toBeNull()

    store.setAccess("jwt.value.here", 900, 1_000_000)

    expect(ACCESS_KEY).toBe("voca.accessToken")
    expect(ACCESS_EXPIRES_KEY).toBe("voca.accessExpiresAt")
    expect(storage.data.get(ACCESS_KEY)).toBe("jwt.value.here")
    expect(storage.data.get(ACCESS_EXPIRES_KEY)).toBe("1900000")

    const reloaded = createTokenStore(storage)
    expect(reloaded.getAccess()).toBe("jwt.value.here")
    expect(reloaded.needsRefresh(1_000_000)).toBe(false)
  })

  test("a token another tab stored is used without a reload", () => {
    const storage = memoryStorage()
    const store = createTokenStore(storage)
    store.setAccess("a1", 900, 0)

    createTokenStore(storage).setAccess("a2", 900, 0)

    expect(store.getAccess()).toBe("a2")
  })

  test("needs a refresh when absent", () => {
    expect(createTokenStore(memoryStorage()).needsRefresh(0)).toBe(true)
  })

  test("needs a refresh when the stored expiry is missing or unreadable", () => {
    const storage = memoryStorage()
    storage.setItem(ACCESS_KEY, "a1")
    expect(createTokenStore(storage).needsRefresh(0)).toBe(true)

    storage.setItem(ACCESS_EXPIRES_KEY, "not a number")
    expect(createTokenStore(storage).needsRefresh(0)).toBe(true)
  })

  test("needs a refresh once fewer than 60 s remain (expiresIn 900 s)", () => {
    const store = createTokenStore(memoryStorage())
    const issuedAt = 1_000_000
    store.setAccess("t", 900, issuedAt)
    expect(store.needsRefresh(issuedAt)).toBe(false)
    expect(store.needsRefresh(issuedAt + 839_999)).toBe(false) // 60.001 s left
    expect(store.needsRefresh(issuedAt + 840_000)).toBe(false) // exactly 60 s left: not "< 60 s"
    expect(store.needsRefresh(issuedAt + 840_001)).toBe(true)
    expect(store.needsRefresh(issuedAt + 900_000)).toBe(true) // expired
  })
})

describe("clear (sign out)", () => {
  test("removes both tokens, and a reloaded store has neither", () => {
    const storage = memoryStorage()
    const store = createTokenStore(storage)
    store.setRefresh("r1")
    store.setAccess("a1", 900, 0)
    store.clear()
    expect(store.getRefresh()).toBeNull()
    expect(store.getAccess()).toBeNull()
    expect(storage.data.size).toBe(0)
    expect(store.needsRefresh(0)).toBe(true)
    expect(createTokenStore(storage).getAccess()).toBeNull()
  })
})
