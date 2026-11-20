import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { Multipart } from "effect/http"
import { DuplicateWord, Forbidden, ImportRejected, NotFound, PayloadTooLarge } from "./errors.ts"
import {
  Count, DeckDescription, DeckTitle, Drill, Example, Instant, LangTag, Meaning, NonNegative, Notes, Page, PageQuery,
  Reading, SearchQuery, SessionSize, Term, Visibility
} from "./primitives.ts"
import { DeckSlug, WordSlug } from "./slug.ts"

// ───── Schemas ─────

/** A snoozed deck's snooze. `until: null` lasts until the Learner unsnoozes; a snooze whose end has passed is no snooze. */
export const DeckSnooze = Schema.Struct({ until: Schema.NullOr(Instant) })
export type DeckSnooze = typeof DeckSnooze.Type

export const Deck = Schema.Struct({
  slug: DeckSlug,
  title: DeckTitle,
  description: DeckDescription,
  termLang: LangTag,
  meaningLang: LangTag,
  visibility: Visibility,
  publishedAt: Schema.NullOr(Instant), // set iff public
  forkedFrom: Schema.NullOr(Schema.Struct({ slug: DeckSlug, title: DeckTitle, deleted: Schema.Boolean })),
  forkCount: Count,
  createdAt: Instant,
  updatedAt: Instant,
  // null when the deck is not snoozed. Optional only while the server rolls out; always sent once snooze ships.
  snooze: Schema.optionalKey(Schema.NullOr(DeckSnooze))
})
export type Deck = typeof Deck.Type

export const DeckSummary = Schema.Struct({ ...Deck.fields, wordCount: Count, dueCount: Count })
export type DeckSummary = typeof DeckSummary.Type

/** `GET /decks/:deckSlug`: the deck with its counts. The counts are optional only while the server rolls out. */
export const DeckDetail = Schema.Struct({ ...Deck.fields, wordCount: Schema.optionalKey(Count), dueCount: Schema.optionalKey(Count) })
export type DeckDetail = typeof DeckDetail.Type

/** A drill available in a deck: applies to at least one word. `label` follows the term language. */
export const DeckDrill = Schema.Struct({ drill: Drill, label: Schema.String, due: Count, new: Count })
export type DeckDrill = typeof DeckDrill.Type

export const CreateDeck = Schema.Struct({
  title: DeckTitle,
  description: Schema.optionalKey(DeckDescription),
  termLang: LangTag,
  meaningLang: LangTag
})

/** `termLang` cannot change once the deck has words: the server answers `Forbidden`. */
export const UpdateDeck = Schema.Struct({
  title: Schema.optionalKey(DeckTitle),
  description: Schema.optionalKey(DeckDescription),
  termLang: Schema.optionalKey(LangTag),
  meaningLang: Schema.optionalKey(LangTag)
})

export const Word = Schema.Struct({
  slug: WordSlug,
  term: Term,
  reading: Schema.NullOr(Reading), // ja: hiragana, zh: pinyin, yue: jyutping
  meaning: Meaning,
  example: Schema.NullOr(Example),
  notes: Schema.NullOr(Notes),
  createdAt: Instant
})
export type Word = typeof Word.Type

/** The Learner's Card for one drill. Drills without a Card are "new". */
export const WordCard = Schema.Struct({ drill: Drill, due: Instant, stabilityDays: NonNegative, isHard: Schema.Boolean })
export type WordCard = typeof WordCard.Type

export const WordWithCards = Schema.Struct({ ...Word.fields, cards: Schema.Array(WordCard) })
export type WordWithCards = typeof WordWithCards.Type

export const CreateWord = Schema.Struct({
  term: Term,
  meaning: Meaning,
  reading: Schema.optionalKey(Reading),
  example: Schema.optionalKey(Example),
  notes: Schema.optionalKey(Notes)
})

/** Absent key = unchanged; `null` clears an optional field. */
export const UpdateWord = Schema.Struct({
  term: Schema.optionalKey(Term),
  meaning: Schema.optionalKey(Meaning),
  reading: Schema.optionalKey(Schema.NullOr(Reading)),
  example: Schema.optionalKey(Schema.NullOr(Example)),
  notes: Schema.optionalKey(Schema.NullOr(Notes))
})

/** How long a snooze lasts, in study days; `null` lasts until unsnoozed. */
export const SnoozeDays = Schema.Literals([1, 3, 7, 14])
export type SnoozeDays = typeof SnoozeDays.Type

/** The decks one snooze or unsnooze acts on: the deck page sends one, the library's selection several. */
export const DeckSlugs = Schema.NonEmptyArray(DeckSlug).check(Schema.isMaxLength(200), Schema.isUnique())

export const SnoozeDecks = Schema.Struct({ deckSlugs: DeckSlugs, days: Schema.NullOr(SnoozeDays) })

export const UnsnoozeDecks = Schema.Struct({ deckSlugs: DeckSlugs })

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024

export const ImportCsv = Schema.Struct({ file: Multipart.SingleFileSchema }).pipe(
  HttpApiSchema.asMultipart({ maxFileSize: IMPORT_MAX_BYTES, maxParts: 1 })
)

export const ImportResult = Schema.Struct({ imported: Count, skippedDuplicates: Count })
export type ImportResult = typeof ImportResult.Type

// ───── Endpoints ─────

const deckParams = { deckSlug: DeckSlug }
const wordParams = { wordSlug: WordSlug }

export class LibraryGroup extends HttpApiGroup.make("library").add(
  HttpApiEndpoint.get("listDecks", "/decks", { success: Schema.Array(DeckSummary) }),
  HttpApiEndpoint.post("createDeck", "/decks", { payload: CreateDeck, success: Deck }),
  HttpApiEndpoint.get("getDeck", "/decks/:deckSlug", { params: deckParams, success: DeckDetail, error: NotFound }),
  HttpApiEndpoint.patch("updateDeck", "/decks/:deckSlug", {
    params: deckParams,
    payload: UpdateDeck,
    success: Deck,
    error: [NotFound, Forbidden] // Forbidden: changing termLang of a deck that has words
  }),
  HttpApiEndpoint.delete("deleteDeck", "/decks/:deckSlug", { params: deckParams, error: NotFound }),
  HttpApiEndpoint.post("publishDeck", "/decks/:deckSlug/publish", { params: deckParams, success: Deck, error: NotFound }),
  HttpApiEndpoint.post("unpublishDeck", "/decks/:deckSlug/unpublish", { params: deckParams, success: Deck, error: NotFound }),
  /** All or nothing: a deck the Learner doesn't own fails the whole batch. A snoozed deck gets the new end. */
  HttpApiEndpoint.post("snoozeDecks", "/decks/snooze", { payload: SnoozeDecks, success: Schema.Array(Deck), error: NotFound }),
  HttpApiEndpoint.post("unsnoozeDecks", "/decks/unsnooze", { payload: UnsnoozeDecks, success: Schema.Array(Deck), error: NotFound }),
  /** The deck's words in a fresh random order: `size` of them, or all when `size` is absent. Reads only. */
  HttpApiEndpoint.get("flashcards", "/decks/:deckSlug/flashcards", {
    params: deckParams,
    query: { size: Schema.optionalKey(SessionSize) },
    success: Schema.Array(Word),
    error: NotFound
  }),
  HttpApiEndpoint.get("listWords", "/decks/:deckSlug/words", {
    params: deckParams,
    query: { q: Schema.optionalKey(SearchQuery), ...PageQuery },
    success: Page(WordWithCards),
    error: NotFound
  }),
  HttpApiEndpoint.post("createWord", "/decks/:deckSlug/words", {
    params: deckParams,
    payload: CreateWord,
    success: Word,
    error: [NotFound, DuplicateWord]
  }),
  HttpApiEndpoint.patch("updateWord", "/words/:wordSlug", {
    params: wordParams,
    payload: UpdateWord,
    success: Word,
    error: [NotFound, DuplicateWord]
  }),
  HttpApiEndpoint.delete("deleteWord", "/words/:wordSlug", { params: wordParams, error: NotFound }),
  HttpApiEndpoint.post("importCsv", "/decks/:deckSlug/import", {
    params: deckParams,
    payload: ImportCsv,
    success: ImportResult,
    error: [NotFound, ImportRejected, PayloadTooLarge]
  }),
  HttpApiEndpoint.get("exportCsv", "/decks/:deckSlug/export", {
    params: deckParams,
    success: Schema.String.pipe(HttpApiSchema.asText({ contentType: "text/csv" })),
    error: NotFound
  })
) {}
