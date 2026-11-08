import { describe, expect, test } from "bun:test"
import { Exit, Schema } from "effect"
import { OpenApi } from "effect/http-api"
import { VocaApi } from "../src/api.ts"
import { CreateWord, UpdateWord } from "../src/library.ts"
import { DeckTitle, DesiredRetention, LangTag, Month, SessionSize, StudyDate, Timezone } from "../src/primitives.ts"
import { Session, StartSession } from "../src/study.ts"
import { UpdateSettings } from "../src/identity.ts"

const ok = (schema: Schema.Top, input: unknown) =>
  Exit.isSuccess(Schema.decodeUnknownExit(schema as Schema.Codec<unknown, unknown>)(input))

describe("invariants live in the Schemas (no CHECKs in the database)", () => {
  test.each([
    ["session size", SessionSize, [7, 10, 15, 20], [8, 0, "10"]],
    ["retention", DesiredRetention, [0.8, 0.9, 0.95], [0.97, 0.79, Number.NaN]],
    ["deck title", DeckTitle, ["N5 Verbs", "  padded  ", "𠮷".repeat(120)], ["", "   ", "a".repeat(121)]],
    ["timezone", Timezone, ["UTC", "Asia/Jakarta", "Asia/Kathmandu", "Pacific/Chatham"], ["Mars/Base", "", "GMT+7x"]],
    ["language tag", LangTag, ["ja", "zh-Hans", "en-US", "yue"], ["", "japanese", "ja_JP"]],
    ["month", Month, ["2026-11", "2026-01"], ["2026-13", "2026-1", "26-11"]],
    ["study date", StudyDate, ["2026-11-04"], ["2026-11-32", "2026-11-4"]]
  ] as const)("%s", (_, schema, valid, invalid) => {
    for (const v of valid) expect(ok(schema, v)).toBe(true)
    for (const v of invalid) expect(ok(schema, v)).toBe(false)
  })

  test("deck title is trimmed on decode", () => {
    expect(Schema.decodeUnknownSync(DeckTitle)("  N5 Verbs  ")).toBe("N5 Verbs")
  })

  test("start session: 1–4 distinct drills", () => {
    const base = { scope: { kind: "deck", deckSlug: "TQ7KM2PV9X" }, size: 10, mode: "easy" }
    expect(ok(StartSession, { ...base, drills: ["term_meaning"] })).toBe(true)
    expect(ok(StartSession, { ...base, drills: ["term_meaning", "meaning_term", "term_reading", "reading_term"] })).toBe(true)
    expect(ok(StartSession, { ...base, drills: [] })).toBe(false)
    expect(ok(StartSession, { ...base, drills: ["term_meaning", "term_meaning"] })).toBe(false)
    expect(ok(StartSession, { ...base, drills: ["term_romaji"] })).toBe(false)
    expect(ok(StartSession, { scope: { kind: "hard" }, drills: ["meaning_term"], size: 7, mode: "hard" })).toBe(true)
    expect(ok(StartSession, { ...base, scope: { kind: "deck", deckSlug: "4HNCR8WYK2JD" }, drills: ["term_meaning"] })).toBe(false) // a word slug
  })

  test("partial updates: absent = unchanged, null clears optional word fields", () => {
    expect(ok(UpdateSettings, {})).toBe(true)
    expect(ok(UpdateSettings, { newPerDay: 201 })).toBe(false)
    expect(ok(UpdateWord, { reading: null })).toBe(true)
    expect(ok(UpdateWord, { term: null })).toBe(false)
    expect(ok(CreateWord, { term: "箸", meaning: "chopsticks", reading: "はし" })).toBe(true)
    expect(ok(CreateWord, { term: "箸" })).toBe(false)
  })
})

describe("wire format", () => {
  test("a Session survives encode → JSON → decode", () => {
    const wire = {
      slug: "G7PX2MQ9VB4KR8",
      drills: ["term_meaning", "term_reading"],
      termLang: "ja",
      mode: "hard",
      size: 10,
      status: "active",
      cleared: 3,
      questions: [{
        position: 4,
        attempt: 2,
        wordSlug: "4HNCR8WYK2JD",
        drill: "term_meaning",
        drillLabel: "Word → Meaning",
        prompt: { text: "箸", ruby: "はし" },
        options: ["4HNCR8WYK2JD", "4HNCR8WYK2JE", "4HNCR8WYK2JF", "4HNCR8WYK2JG"].map((wordSlug, i) => ({
          wordSlug,
          text: ["chopsticks", "bridge", "edge", "to eat"][i]
        }))
      }]
    }
    const decoded = Schema.decodeUnknownSync(Session)(wire)
    expect(JSON.parse(JSON.stringify(Schema.encodeSync(Session)(decoded)))).toEqual(wire)
  })

  test("a question needs exactly 4 options", () => {
    const q = (n: number) => ({
      slug: "G7PX2MQ9VB4KR8", drills: ["term_meaning"], termLang: "ja", mode: "easy", size: 7, status: "active", cleared: 0,
      questions: [{
        position: 1, attempt: 1, wordSlug: "4HNCR8WYK2JD", drill: "term_meaning", drillLabel: "Word → Meaning",
        prompt: { text: "箸", ruby: null },
        options: Array.from({ length: n }, () => ({ wordSlug: "4HNCR8WYK2JD", text: "x" }))
      }]
    })
    expect(ok(Session, q(4))).toBe(true)
    expect(ok(Session, q(3))).toBe(false)
    expect(ok(Session, q(5))).toBe(false)
  })
})

describe("endpoint inventory matches docs/07-api.md", () => {
  // One line per row of the API tables. Adding or removing an endpoint must update both.
  const expected = [
    "get /api/healthz",
    "post /api/auth/google", "post /api/auth/refresh", "post /api/auth/logout",
    "get /api/me", "patch /api/me/settings", "get /api/me/activity",
    "get /api/decks", "post /api/decks", "get /api/decks/{deckSlug}", "get /api/decks/{deckSlug}/drills",
    "patch /api/decks/{deckSlug}", "delete /api/decks/{deckSlug}",
    "post /api/decks/{deckSlug}/publish", "post /api/decks/{deckSlug}/unpublish",
    "get /api/decks/{deckSlug}/words", "post /api/decks/{deckSlug}/words",
    "patch /api/words/{wordSlug}", "delete /api/words/{wordSlug}",
    "post /api/decks/{deckSlug}/import", "get /api/decks/{deckSlug}/export",
    "get /api/community/decks", "get /api/community/decks/{deckSlug}", "post /api/community/decks/{deckSlug}/fork",
    "post /api/sessions", "get /api/sessions/active", "post /api/sessions/{sessionSlug}/answers",
    "post /api/sessions/{sessionSlug}/abandon",
    "get /api/hard-words", "put /api/words/{wordSlug}/drills/{drill}/hard", "delete /api/words/{wordSlug}/drills/{drill}/hard",
    "get /api/words/{wordSlug}/stats", "get /api/decks/{deckSlug}/stats", "get /api/notifications"
  ]

  const spec = OpenApi.fromApi(VocaApi)
  const actual = Object.entries(spec.paths).flatMap(([path, item]) =>
    ["get", "post", "put", "patch", "delete"].filter((m) => m in (item as object)).map((m) => `${m} ${path}`)
  )

  test("same set of routes", () => {
    expect(actual.sort()).toEqual([...expected].sort())
  })

  test("bearer auth everywhere except /auth/* and /healthz", () => {
    for (const [path, item] of Object.entries(spec.paths)) {
      const isPublic = path.startsWith("/api/auth/") || path === "/api/healthz"
      for (const op of Object.values(item as Record<string, { security?: unknown[] }>)) {
        expect([path, (op.security?.length ?? 0) > 0]).toEqual([path, !isPublic])
      }
    }
  })
})
