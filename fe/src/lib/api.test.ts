import { expect, test } from "bun:test"
import { Result } from "effect"
import { callApi } from "./api.ts"

// How frontend code calls the API, and how to test it without a server: pass a fake `fetch`.
const learner = {
  slug: "ABCDEFGH", email: "ada@example.com", name: "Ada", avatarUrl: null, createdAt: "2026-11-01T00:00:00.000Z",
  settings: { timezone: "UTC", dayStartHour: 4, desiredRetention: 0.9, newPerDay: 20, defaultSessionSize: 10, defaultMode: "easy" }
}

const fakeFetch = (respond: (request: Request) => Response) => {
  const requests: Array<Request> = []
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    requests.push(request)
    return respond(request)
  }) as typeof globalThis.fetch
  return { fetch, requests }
}
const json = (status: number, body: unknown) => Response.json(body, { status })

test("a protected call sends the bearer token and decodes the typed response", async () => {
  const { fetch, requests } = fakeFetch(() => json(200, learner))
  const result = await callApi({ baseUrl: "http://test", fetch, getAccessToken: () => "jwt-1" }, (c) => c.me.get())
  expect(requests[0]?.url).toBe("http://test/api/me")
  expect(requests[0]?.headers.get("authorization")).toBe("Bearer jwt-1")
  expect(Result.isSuccess(result) && result.success.email).toBe("ada@example.com")
})

test("a contract error comes back as a typed failure, not a thrown exception", async () => {
  const { fetch } = fakeFetch(() => json(401, { _tag: "Unauthorized", message: "expired" }))
  const result = await callApi({ baseUrl: "http://test", fetch, getAccessToken: () => "old" }, (c) => c.me.get())
  expect(Result.isFailure(result) && (result.failure as { _tag?: string })._tag).toBe("Unauthorized")
})

test("without a token, no Authorization header is sent", async () => {
  const { fetch, requests } = fakeFetch(() => json(401, { _tag: "Unauthorized", message: "missing" }))
  await callApi({ baseUrl: "http://test", fetch, getAccessToken: () => null }, (c) => c.me.get())
  expect(requests[0]?.headers.get("authorization")).toBeNull()
})
