import type { Effect, Option } from "effect"
import { Context } from "effect"
import type { Deck, DeckSort, DeckSummary, PublicDeck, UpdateDeck } from "@voca/contract"

/** A deck the Learner owns, with its internal id for later calls. */
export interface OwnedDeck {
  readonly id: bigint
  readonly deck: Deck
}

/** The counts a deck page shows: live words, and the owner's live cards of live words that are due. */
export interface DeckCounts {
  readonly wordCount: number
  readonly dueCount: number
}

/** A deck to insert: the slug, trimmed text and clock time are already decided. `forkedFromId` is set for a fork. */
export interface NewDeck {
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly termLang: string
  readonly meaningLang: string
  readonly createdAt: number
  readonly forkedFromId: bigint | null
}

/** The Learner's timezone and day start hour: the study day a snooze's end falls on. */
export interface StudyClock {
  readonly timezone: string
  readonly dayStartHour: number
}

/** A live deck of any Learner, public or not, with its internal id: what a fork starts from. */
export type LiveDeck = { readonly id: bigint } & Pick<
  Deck,
  "visibility" | "title" | "description" | "termLang" | "meaningLang"
>

/** A public deck with its internal id, for the detail page. */
export interface PublicDeckFound {
  readonly id: bigint
  readonly deck: PublicDeck
}

/**
 * `q` is already normalized and `termLang` is an exact tag. `sort` is "new" (published most recently) or "forks"
 * (most forked). `limit` is the page size, without the extra row used to find the next cursor.
 */
export interface PublicDeckQuery {
  readonly q: string | null
  readonly termLang: string | null
  readonly sort: "new" | "forks"
  readonly cursor: string | null
  readonly limit: number
}

export interface PublicDeckPage {
  readonly items: ReadonlyArray<PublicDeck>
  readonly nextCursor: string | null
}

/**
 * Decks. The owner-scoped calls see only the owner's live decks; the community reads see every Learner's live decks.
 * Deleted decks are invisible everywhere. Infrastructure failures are defects.
 */
export class DeckRepo extends Context.Service<DeckRepo, {
  /**
   * One page of the owner's live decks in the query's order, with the library's total and term languages. Counts are
   * taken at `now` (epoch millis). Every Deck returned carries its snooze as of `now`: a snooze whose end has passed
   * reads as none.
   */
  listPage(learnerId: bigint, query: OwnedDeckQuery, now: number): Effect.Effect<OwnedDeckPage>
  findOwned(learnerId: bigint, slug: string, now: number): Effect.Effect<Option.Option<OwnedDeck>>
  /** The live word count and the owner's due card count of one deck, the same numbers the library page shows; `now` is epoch millis. */
  counts(deckId: bigint, learnerId: bigint, now: number): Effect.Effect<DeckCounts>
  insert(learnerId: bigint, deck: NewDeck): Effect.Effect<OwnedDeck>
  /** Changes only the fields `patch` sends, and sets `updatedAt` (epoch millis). */
  update(deckId: bigint, patch: typeof UpdateDeck.Type, updatedAt: number): Effect.Effect<Deck>
  /** Makes the deck public, with `published_at` set to `at` (epoch millis). */
  publish(deckId: bigint, at: number): Effect.Effect<Deck>
  /** Makes the deck private and clears `published_at`. */
  unpublish(deckId: bigint, at: number): Effect.Effect<Deck>
  /** Snoozes the deck from `snoozedAt` until `until` (epoch millis); `null` lasts until unsnoozed. Replaces any earlier snooze. */
  snooze(deckId: bigint, snoozedAt: number, until: number | null): Effect.Effect<Deck>
  /** Clears the snooze of the deck, timed or not; `at` is epoch millis. */
  unsnooze(deckId: bigint, at: number): Effect.Effect<Deck>
  /** The timezone and day start hour of the Learner, which decide where a snooze's end falls. */
  studyClock(learnerId: bigint): Effect.Effect<StudyClock>
  incrementForkCount(deckId: bigint): Effect.Effect<void>
  hasWords(deckId: bigint): Effect.Effect<boolean>
  softDelete(deckId: bigint, at: number): Effect.Effect<void>
  /** Live public decks of every Learner, in the query's sort order, one page at a time. */
  listPublic(query: PublicDeckQuery): Effect.Effect<PublicDeckPage>
  /** A live public deck by slug; None when it is private, deleted or missing. */
  findPublic(deckSlug: string): Effect.Effect<Option.Option<PublicDeckFound>>
  /** A live deck by slug, public or private; None when it is deleted or missing. */
  findLive(deckSlug: string): Effect.Effect<Option.Option<LiveDeck>>
}>()("voca/library/DeckRepo") {}

/** The library's order: "newest" is the default; the others are the `DeckSort` values. */
export type DeckOrder = DeckSort | "newest"

/** `q` is already normalized and `termLang` is an exact tag. `limit` is the page size, without the extra row. */
export interface OwnedDeckQuery {
  readonly q: string | null
  readonly termLang: string | null
  readonly order: DeckOrder
  readonly cursor: string | null
  readonly limit: number
}

/** `total` and `termLangs` describe the whole library: they ignore the query and the page. */
export interface OwnedDeckPage {
  readonly items: ReadonlyArray<DeckSummary>
  readonly nextCursor: string | null
  readonly total: number
  readonly termLangs: ReadonlyArray<string>
}
