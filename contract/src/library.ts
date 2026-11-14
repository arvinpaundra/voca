import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"
import { Multipart } from "effect/http"
import { DuplicateWord, Forbidden, ImportRejected, NotFound, PayloadTooLarge } from "./errors.ts"
import {
  Count, DeckDescription, DeckTitle, Drill, Example, Instant, LangTag, Meaning, NonNegative, Notes, Page, PageQuery,
  Reading, SearchQuery, Term, Visibility
} from "./primitives.ts"
import { DeckSlug, WordSlug } from "./slug.ts"

// ───── Schemas ─────

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
  updatedAt: Instant
})
export type Deck = typeof Deck.Type

export const DeckSummary = Schema.Struct({ ...Deck.fields, wordCount: Count, dueCount: Count })
export type DeckSummary = typeof DeckSummary.Type

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
  HttpApiEndpoint.get("getDeck", "/decks/:deckSlug", { params: deckParams, success: Deck, error: NotFound }),
  HttpApiEndpoint.get("deckDrills", "/decks/:deckSlug/drills", {
    params: deckParams,
    success: Schema.Array(DeckDrill),
    error: NotFound
  }),
  HttpApiEndpoint.patch("updateDeck", "/decks/:deckSlug", {
    params: deckParams,
    payload: UpdateDeck,
    success: Deck,
    error: [NotFound, Forbidden] // Forbidden: changing termLang of a deck that has words
  }),
  HttpApiEndpoint.delete("deleteDeck", "/decks/:deckSlug", { params: deckParams, error: NotFound }),
  HttpApiEndpoint.post("publishDeck", "/decks/:deckSlug/publish", { params: deckParams, success: Deck, error: NotFound }),
  HttpApiEndpoint.post("unpublishDeck", "/decks/:deckSlug/unpublish", { params: deckParams, success: Deck, error: NotFound }),
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
