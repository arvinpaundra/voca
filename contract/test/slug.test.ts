import { describe, expect, test } from "bun:test"
import { Exit, Schema } from "effect"
import { ALPHABET, DeckSlug, LearnerSlug, SessionSlug, SLUG_LENGTH, slug, WordSlug } from "../src/slug.ts"

const bytes = (...values: number[]) => Uint8Array.from(values)
const decodes = (schema: Schema.Codec<unknown, string>, input: string) =>
  Exit.isSuccess(Schema.decodeUnknownExit(schema)(input))

describe("slug()", () => {
  test("one uppercase Crockford character per byte", () => {
    const s = slug(crypto.getRandomValues(new Uint8Array(14)))
    expect(s).toHaveLength(14)
    expect(s).toMatch(/^[0-9A-HJKMNP-TV-Z]{14}$/)
  })

  test("deterministic for the same bytes", () => {
    expect(slug(bytes(0, 31, 32, 255))).toBe("0Z0Z")
  })

  test("no bias: all 256 byte values map onto the 32 characters exactly 8 times each", () => {
    const counts = new Map<string, number>()
    for (const ch of slug(Uint8Array.from({ length: 256 }, (_, i) => i))) counts.set(ch, (counts.get(ch) ?? 0) + 1)
    expect([...counts.keys()].sort().join("")).toBe([...ALPHABET].sort().join(""))
    expect(new Set(counts.values())).toEqual(new Set([8]))
  })

  test("alphabet leaves out I, L, O, U", () => {
    expect(ALPHABET).toHaveLength(32)
    expect(ALPHABET).not.toMatch(/[ILOU]/)
  })
})

describe("slug schemas", () => {
  const cases = [
    [LearnerSlug, SLUG_LENGTH.learner],
    [DeckSlug, SLUG_LENGTH.deck],
    [WordSlug, SLUG_LENGTH.word],
    [SessionSlug, SLUG_LENGTH.session]
  ] as const

  test.each(cases)("accepts its own length only (%#)", (schema, length) => {
    for (const n of [8, 10, 12, 14]) expect(decodes(schema, "K".repeat(n))).toBe(n === length)
  })

  test("lowercase input decodes to uppercase", () => {
    expect(Schema.decodeUnknownSync(DeckSlug)("tq7km2pv9x")).toBe(DeckSlug.make("TQ7KM2PV9X"))
  })

  test("rejects characters outside the alphabet", () => {
    expect(decodes(DeckSlug, "TQ7LM2PV9I")).toBe(false) // I
    expect(decodes(DeckSlug, "TQ7LM2PV9U")).toBe(false) // U
    expect(decodes(DeckSlug, "TQ7LM2PV9-")).toBe(false)
  })
})
// tamper
