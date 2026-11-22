// Helpers for the paged-list tests: a server that pages an array by cursor, a fake IntersectionObserver the test
// can fire, a phone or wider viewport, and the wire shapes of the lists (decks, public decks, words, hard words).
import type { DeckSummary, HardWord, PublicDeck, WordWithCards } from "@voca/contract"

export const pad = (n: number) => String(n).padStart(2, "0")

/** The page of `all` a request asks for: the cursor is the index to continue from; `limit` defaults to 50. */
export const pageOf = <T>(all: readonly T[], query: { readonly cursor?: string; readonly limit?: number }) => {
  const start = query.cursor === undefined ? 0 : Number(query.cursor)
  const items = all.slice(start, start + (query.limit ?? 50))
  const end = start + items.length

  return { items, nextCursor: end < all.length ? String(end) : null }
}

type Observer = { readonly callback: IntersectionObserverCallback; readonly targets: Element[]; disconnected: boolean }

/** Replaces IntersectionObserver. `intersect()` tells every live observer that its elements scrolled into view. */
export const fakeObserver = () => {
  const original = globalThis.IntersectionObserver
  const observers: Observer[] = []

  class FakeObserver {
    private readonly state: Observer

    constructor(callback: IntersectionObserverCallback) {
      this.state = { callback, targets: [], disconnected: false }
      observers.push(this.state)
    }

    observe(target: Element) {
      this.state.targets.push(target)
    }

    unobserve() {}

    disconnect() {
      this.state.disconnected = true
    }

    takeRecords() {
      return []
    }
  }

  globalThis.IntersectionObserver = FakeObserver as unknown as typeof IntersectionObserver

  const intersect = () => {
    for (const observer of observers.filter((o) => !o.disconnected)) {
      const entries = observer.targets.map((target) => ({ isIntersecting: true, target }) as IntersectionObserverEntry)
      observer.callback(entries, {} as IntersectionObserver)
    }
  }

  return { intersect, restore: () => (globalThis.IntersectionObserver = original) }
}

export const deckSummary = (i: number, termLang = "ja") =>
  ({
    slug: `DECK${String(i).padStart(6, "0")}`,
    title: `Deck ${pad(i)}`,
    description: "",
    termLang,
    meaningLang: "en",
    visibility: "private",
    publishedAt: null,
    forkedFrom: null,
    forkCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    snooze: null,
    wordCount: 12,
    dueCount: 3
  }) as unknown as DeckSummary

export const publicDeck = (i: number, termLang = "ja") =>
  ({
    slug: `DECK${String(i).padStart(6, "0")}`,
    title: `Public ${pad(i)}`,
    description: "",
    termLang,
    meaningLang: "en",
    publishedAt: "2026-10-01T00:00:00.000Z",
    forkCount: 10,
    wordCount: 50,
    owner: { name: "Mika T.", avatarUrl: null }
  }) as unknown as PublicDeck

export const listedWord = (i: number) =>
  ({
    slug: `WRD${String(i).padStart(9, "0")}`,
    term: `語${pad(i)}`,
    reading: null,
    meaning: `meaning ${pad(i)}`,
    example: null,
    notes: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    cards: []
  }) as unknown as WordWithCards

export const hardWordOf = (i: number, drill: string, due: string) =>
  ({
    slug: `WRD${String(i).padStart(9, "0")}`,
    term: `語${pad(i)}`,
    reading: null,
    meaning: `meaning ${pad(i)}`,
    example: null,
    notes: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    cards: [{ drill, due, stabilityDays: 4, isHard: true }],
    deck: { slug: "DECK000001", title: "Japanese N5 verbs", termLang: "ja", meaningLang: "en" }
  }) as unknown as HardWord

/** Makes the viewport a phone's, or wider, for `matchMedia`; `restore()` puts the real one back. */
export const fakeViewport = (phone: boolean) => {
  const original = window.matchMedia

  window.matchMedia = ((query: string) =>
    ({
      matches: phone && query === "(max-width: 640px)",
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    }) as unknown as MediaQueryList) as typeof window.matchMedia

  return { restore: () => (window.matchMedia = original) }
}
