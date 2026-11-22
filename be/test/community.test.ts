import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { DateTime, Effect } from "effect"
import { SqlClient } from "effect/sql"
import { ALPHABET } from "@voca/contract"
import { TokenSigner } from "../src/identity/application/ports.ts"
import { normalizeKey } from "../src/library/domain/text.ts"
import { at, call, makeIdentityRuntime, seedLearner } from "./identity.ts"
import { resetDb } from "./setup.ts"

// Publishing and community decks over HTTP. Decks and words are seeded with SQL.
// A private or deleted deck answers 404 to everyone but its owner's library, so its existence never leaks.

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T00:00:00Z"))))

let serial = 0

const nextSlug = (length: number) =>
  (++serial)
    .toString(32)
    .padStart(length, "0")
    .split("")
    .map((digit) => ALPHABET[parseInt(digit, 32)])
    .join("")

const signedIn = (slug: string) =>
  Effect.gen(function* () {
    const id = yield* seedLearner(slug)
    const signer = yield* TokenSigner
    const token = (yield* signer.sign(slug as never)).token
    return { id, token }
  })

type DeckSeed = {
  readonly title?: string
  readonly termLang?: string
  readonly publishedAt?: string | null
  readonly forkCount?: number
  readonly words?: number
  readonly deleted?: boolean
}

/** A deck with `words` words added one second apart; public when `publishedAt` is set. */
const seedDeck = (ownerId: bigint, seed: DeckSeed = {}) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const deckSlug = nextSlug(10)
    const publishedAt = seed.publishedAt ?? null

    const [deck] = yield* sql<{ readonly id: string }>`
      INSERT INTO decks (slug, owner_id, title, description, term_lang, meaning_lang, visibility, published_at,
        fork_count, created_at, updated_at, deleted_at)
      VALUES (${deckSlug}, ${ownerId}, ${seed.title ?? "Deck"}, 'About this deck', ${seed.termLang ?? "ja"}, 'en',
        ${publishedAt === null ? "private" : "public"}, ${publishedAt === null ? null : new Date(publishedAt)},
        ${seed.forkCount ?? 0}, '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z',
        ${seed.deleted ? new Date("2026-11-10T00:00:00Z") : null})
      RETURNING id::text AS id`

    for (let i = 0; i < (seed.words ?? 0); i++) {
      yield* sql`
        INSERT INTO words (slug, deck_id, term, reading, meaning, example, term_key, reading_key, meaning_key, created_at)
        VALUES (${nextSlug(12)}, ${deck!.id}, ${`語${i}`}, ${`ご${i}`}, ${`meaning ${i}`}, ${i === 0 ? "例文" : null},
          ${normalizeKey(`語${i}`)}, ${normalizeKey(`ご${i}`)}, ${normalizeKey(`meaning ${i}`)},
          ${new Date(Date.parse("2026-11-01T00:00:00Z") + i * 1000)})`
    }

    return { deckSlug, deckId: BigInt(deck!.id) }
  })

const publish = (token: string, deckSlug: string) =>
  call((c) => c.library.publishDeck({ params: { deckSlug: deckSlug as never } }), token)

const unpublish = (token: string, deckSlug: string) =>
  call((c) => c.library.unpublishDeck({ params: { deckSlug: deckSlug as never } }), token)

type ListQuery = { q?: string; termLang?: string; sort?: "new" | "forks"; cursor?: string; limit?: number }

const list = (token: string, query: ListQuery = {}) => call((c) => c.community.list({ query }), token)

const get = (token: string, deckSlug: string) =>
  call((c) => c.community.get({ params: { deckSlug: deckSlug as never } }), token)

const fork = (token: string, deckSlug: string) =>
  call((c) => c.community.fork({ params: { deckSlug: deckSlug as never } }), token)

const slugsOf = (items: ReadonlyArray<{ readonly slug: string }>) => items.map((item) => String(item.slug))

describe("publish and unpublish", () => {
  test("publishing makes the deck public now; unpublishing makes it private again", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const deck = yield* seedDeck(id, { words: 1 })

        const published = yield* publish(token, deck.deckSlug)

        expect(published.visibility).toBe("public")
        expect(DateTime.formatIso(published.publishedAt!)).toBe("2026-11-14T00:00:00.000Z")
        expect(slugsOf((yield* list(token)).items)).toEqual([deck.deckSlug])

        const unpublished = yield* unpublish(token, deck.deckSlug)

        expect(unpublished.visibility).toBe("private")
        expect(unpublished.publishedAt).toBeNull()
        expect((yield* list(token)).items).toEqual([])
      })
    ))

  test("only the owner can publish or unpublish", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const owner = yield* signedIn("ABCDEFGH")
        const other = yield* signedIn("HGFEDCBA")
        const deck = yield* seedDeck(owner.id, { publishedAt: "2026-11-02T00:00:00Z" })

        expect((yield* Effect.flip(publish(other.token, deck.deckSlug)))._tag).toBe("NotFound")
        expect((yield* Effect.flip(unpublish(other.token, deck.deckSlug)))._tag).toBe("NotFound")
      })
    ))
})

describe("GET /community/decks", () => {
  test("lists live public decks of every Learner, newest first, with word counts and owners", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const me = yield* signedIn("ABCDEFGH")
        const other = yield* signedIn("HGFEDCBA")
        const older = yield* seedDeck(other.id, { publishedAt: "2026-11-02T00:00:00Z", words: 3 })
        const newer = yield* seedDeck(me.id, { publishedAt: "2026-11-05T00:00:00Z", words: 1 })

        yield* seedDeck(other.id, { words: 2 })
        yield* seedDeck(other.id, { publishedAt: "2026-11-06T00:00:00Z", deleted: true })

        const page = yield* list(me.token)

        expect(slugsOf(page.items)).toEqual([newer.deckSlug, older.deckSlug])
        expect(page.nextCursor).toBeNull()

        const first = page.items[1]!

        expect(first.wordCount).toBe(3)
        expect(first.owner).toEqual({ name: "Learner HGFEDCBA", avatarUrl: null })
        expect(first.title).toBe("Deck")
        expect(first.description).toBe("About this deck")
        expect(DateTime.formatIso(first.publishedAt)).toBe("2026-11-02T00:00:00.000Z")
        expect(first).not.toHaveProperty("email")
      })
    ))

  test("searches titles, filters by term language and sorts by forks", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const n5 = yield* seedDeck(id, { title: "JLPT N5", publishedAt: "2026-11-02T00:00:00Z", forkCount: 9 })
        const kitchen = yield* seedDeck(id, { title: "Kitchen", publishedAt: "2026-11-03T00:00:00Z", forkCount: 1 })
        const hsk = yield* seedDeck(id, {
          title: "HSK 1",
          termLang: "zh-Hans",
          publishedAt: "2026-11-04T00:00:00Z",
          forkCount: 4
        })

        expect(slugsOf((yield* list(token, { q: "jlpt" })).items)).toEqual([n5.deckSlug])
        expect(slugsOf((yield* list(token, { termLang: "ja" })).items)).toEqual([kitchen.deckSlug, n5.deckSlug])
        expect(slugsOf((yield* list(token, { sort: "forks" })).items)).toEqual([
          n5.deckSlug,
          hsk.deckSlug,
          kitchen.deckSlug
        ])
      })
    ))

  test("pages with a cursor", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const { id, token } = yield* signedIn("ABCDEFGH")
        const a = yield* seedDeck(id, { publishedAt: "2026-11-02T00:00:00Z" })
        const b = yield* seedDeck(id, { publishedAt: "2026-11-03T00:00:00Z" })
        const c = yield* seedDeck(id, { publishedAt: "2026-11-04T00:00:00Z" })

        const first = yield* list(token, { limit: 2 })
        const second = yield* list(token, { limit: 2, cursor: first.nextCursor! })

        expect(slugsOf(first.items)).toEqual([c.deckSlug, b.deckSlug])
        expect(slugsOf(second.items)).toEqual([a.deckSlug])
        expect(second.nextCursor).toBeNull()
      })
    ))
})

describe("GET /community/decks/:deckSlug", () => {
  test("shows a public deck with up to 20 words, oldest first", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const me = yield* signedIn("ABCDEFGH")
        const other = yield* signedIn("HGFEDCBA")
        const deck = yield* seedDeck(other.id, { publishedAt: "2026-11-02T00:00:00Z", words: 25 })

        const detail = yield* get(me.token, deck.deckSlug)

        expect(detail.wordCount).toBe(25)
        expect(detail.preview).toHaveLength(20)
        expect(detail.preview[0]!.term).toBe("語0")
        expect(detail.preview[0]!.example).toBe("例文")
        expect(detail.preview[19]!.term).toBe("語19")
      })
    ))

  test("a private or deleted deck is not found", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const me = yield* signedIn("ABCDEFGH")
        const privateDeck = yield* seedDeck(me.id)
        const deletedDeck = yield* seedDeck(me.id, { publishedAt: "2026-11-02T00:00:00Z", deleted: true })

        expect((yield* Effect.flip(get(me.token, privateDeck.deckSlug)))._tag).toBe("NotFound")
        expect((yield* Effect.flip(get(me.token, deletedDeck.deckSlug)))._tag).toBe("NotFound")
      })
    ))
})

describe("POST /community/decks/:deckSlug/fork", () => {
  test("copies the deck and its live words into a new private deck of the Learner", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const me = yield* signedIn("ABCDEFGH")
        const other = yield* signedIn("HGFEDCBA")
        const source = yield* seedDeck(other.id, { title: "JLPT N5", publishedAt: "2026-11-02T00:00:00Z", words: 3 })
        const sql = yield* SqlClient.SqlClient

        yield* sql`UPDATE words SET deleted_at = now() WHERE deck_id = ${source.deckId} AND term = '語2'`

        const copy = yield* fork(me.token, source.deckSlug)

        expect(copy.slug).not.toBe(source.deckSlug)
        expect(copy.title).toBe("JLPT N5")
        expect(copy.description).toBe("About this deck")
        expect(copy.visibility).toBe("private")
        expect(copy.publishedAt).toBeNull()
        expect(copy.forkCount).toBe(0)
        expect(copy.forkedFrom).toEqual({ slug: source.deckSlug as never, title: "JLPT N5", deleted: false })

        const words = yield* call(
          (c) => c.library.listWords({ params: { deckSlug: copy.slug }, query: {} }),
          me.token
        )

        expect(words.items.map((word) => word.term).sort()).toEqual(["語0", "語1"])
        expect(words.items.every((word) => word.cards.length === 0)).toBe(true)
        expect(words.items.find((word) => word.term === "語0")!.example).toBe("例文")

        const detail = yield* get(me.token, source.deckSlug)

        expect(detail.forkCount).toBe(1)
      })
    ))

  test("the fork lists in the library with its attribution, which survives the source's deletion", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const me = yield* signedIn("ABCDEFGH")
        const other = yield* signedIn("HGFEDCBA")
        const source = yield* seedDeck(other.id, { title: "Kitchen", publishedAt: "2026-11-02T00:00:00Z", words: 1 })
        const sql = yield* SqlClient.SqlClient

        const copy = yield* fork(me.token, source.deckSlug)

        yield* sql`UPDATE decks SET deleted_at = now() WHERE id = ${source.deckId}`

        const library = yield* call((c) => c.library.listDecks({ query: {} }).pipe(Effect.map((page) => page.items)), me.token)
        const again = yield* call((c) => c.library.getDeck({ params: { deckSlug: copy.slug } }), me.token)

        expect(library.map((deck) => [String(deck.slug), deck.wordCount, deck.forkedFrom])).toEqual([
          [String(copy.slug), 1, { slug: source.deckSlug as never, title: "Kitchen", deleted: true }]
        ])
        expect(again.forkedFrom).toEqual({ slug: source.deckSlug as never, title: "Kitchen", deleted: true })
      })
    ))

  test("a private deck cannot be forked, and an unknown one is not found", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const me = yield* signedIn("ABCDEFGH")
        const other = yield* signedIn("HGFEDCBA")
        const privateDeck = yield* seedDeck(other.id, { words: 1 })

        expect((yield* Effect.flip(fork(me.token, privateDeck.deckSlug)))._tag).toBe("DeckNotPublic")
        expect((yield* Effect.flip(fork(me.token, "TQ7KM2PV9X")))._tag).toBe("NotFound")
      })
    ))
})
