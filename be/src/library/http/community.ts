import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { DeckNotPublic, NotFound, VocaApi } from "@voca/contract"
import { forkDeck, getPublicDeck, listPublicDecks } from "../application/community.ts"
import type { DeckRepo } from "../application/deckRepo.ts"
import type { WordRepo } from "../application/wordRepo.ts"
import type { Transaction } from "../../shared/transaction.ts"

const notFound = (what: string) => () => Effect.fail(new NotFound({ message: `${what} not found` }))

// Each endpoint calls its use case and maps the domain errors to the contract's.
export const CommunityHandlers = HttpApiBuilder.group(
  VocaApi,
  "community",
  Effect.fn(function* (handlers) {
    const ports = yield* Effect.context<DeckRepo | WordRepo | Transaction>()

    return handlers.handleAll({
      list: ({ query }) => listPublicDecks(query).pipe(Effect.provideContext(ports)),

      get: ({ params }) =>
        getPublicDeck(params.deckSlug).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("DeckNotFound", notFound("Deck"))
        ),

      fork: ({ params }) =>
        forkDeck(params.deckSlug).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("DeckNotFound", notFound("Deck")),
          Effect.catchTag("DeckNotPublic", () => Effect.fail(new DeckNotPublic({ message: "Deck not found" })))
        )
    })
  })
)
