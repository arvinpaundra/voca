import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api"
import { DeckNotPublic, NotFound } from "./errors.ts"
import { Count, DeckDescription, DeckTitle, Instant, LangTag, Page, PageQuery, SearchQuery } from "./primitives.ts"
import { Deck, Word } from "./library.ts"
import { DeckSlug } from "./slug.ts"

export const PublicDeck = Schema.Struct({
  slug: DeckSlug,
  title: DeckTitle,
  description: DeckDescription,
  termLang: LangTag,
  meaningLang: LangTag,
  publishedAt: Instant,
  forkCount: Count,
  wordCount: Count,
  owner: Schema.Struct({ name: Schema.String, avatarUrl: Schema.NullOr(Schema.String) }) // never the email
})
export type PublicDeck = typeof PublicDeck.Type

export const PREVIEW_WORDS = 20

export const PublicDeckDetail = Schema.Struct({
  ...PublicDeck.fields,
  preview: Schema.Array(Word).check(Schema.isMaxLength(PREVIEW_WORDS))
})
export type PublicDeckDetail = typeof PublicDeckDetail.Type

export const CommunitySort = Schema.Literals(["new", "forks"])

const deckParams = { deckSlug: DeckSlug }

export class CommunityGroup extends HttpApiGroup.make("community").add(
  HttpApiEndpoint.get("list", "/community/decks", {
    query: {
      q: Schema.optionalKey(SearchQuery),
      termLang: Schema.optionalKey(LangTag),
      sort: Schema.optionalKey(CommunitySort), // default "new"
      ...PageQuery
    },
    success: Page(PublicDeck)
  }),
  HttpApiEndpoint.get("get", "/community/decks/:deckSlug", { params: deckParams, success: PublicDeckDetail, error: NotFound }),
  /** Copies the deck and its live words into a new private deck with fresh study state. */
  HttpApiEndpoint.post("fork", "/community/decks/:deckSlug/fork", {
    params: deckParams,
    success: Deck,
    error: [NotFound, DeckNotPublic]
  })
) {}
