import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import {
  DeckTooSmall,
  DrillNotAvailable,
  NotFound,
  QuestionAlreadyAnswered as QuestionAlreadyAnsweredContract,
  SessionNotActive as SessionNotActiveContract,
  VocaApi
} from "@voca/contract"
import { abandonSession, activeSession, startSession } from "../application/sessions.ts"
import { answerQuestion } from "../application/answer.ts"
import { deckDrills } from "../application/deckDrills.ts"
import type { StudyRepo } from "../application/studyRepo.ts"
import type { Transaction } from "../../shared/transaction.ts"

const notFound = (what: string) => () => Effect.fail(new NotFound({ message: `${what} not found` }))

const alreadyAnswered = () =>
  Effect.fail(new QuestionAlreadyAnsweredContract({ message: "This question was already answered" }))

const notActive = () => Effect.fail(new SessionNotActiveContract({ message: "The session has ended" }))

// Each endpoint calls its use case and maps the domain errors to the contract's. Hard Words belong to a later feature.
export const StudyHandlers = HttpApiBuilder.group(
  VocaApi,
  "study",
  Effect.fn(function* (handlers) {
    const ports = yield* Effect.context<StudyRepo | Transaction>()

    return handlers.handleAll({
      deckDrills: ({ params }) =>
        deckDrills(params.deckSlug).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("DeckNotFound", notFound("Deck"))
        ),

      start: ({ payload }) => {
        // The Hard Words place is a later feature, so its scope has no session yet.
        if (payload.scope.kind === "hard") {
          return Effect.die("not implemented: B-H")
        }

        return startSession(payload.scope.deckSlug, { drills: payload.drills, size: payload.size }).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("DeckNotFound", notFound("Deck")),
          Effect.catchTag(
            "DeckTooSmallError",
            () => Effect.fail(new DeckTooSmall({ message: "The deck needs at least 4 words with distinct answers" }))
          ),
          Effect.catchTag(
            "DrillNotAvailableError",
            () => Effect.fail(new DrillNotAvailable({ message: "None of these drills applies to a word in the deck" }))
          )
        )
      },

      active: () => activeSession().pipe(Effect.provideContext(ports)),

      answer: ({ params, payload }) =>
        answerQuestion(params.sessionSlug, payload).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("SessionNotFound", notFound("Session")),
          Effect.catchTag("QuestionNotFound", notFound("Question")),
          Effect.catchTag("QuestionAlreadyAnswered", alreadyAnswered),
          Effect.catchTag("SessionNotActive", notActive)
        ),

      abandon: ({ params }) =>
        abandonSession(params.sessionSlug).pipe(
          Effect.provideContext(ports),
          Effect.catchTag("SessionNotFound", notFound("Session"))
        ),

      hardWords: () => Effect.die("not implemented: B-H"),
      markHard: () => Effect.die("not implemented: B-H"),
      unmarkHard: () => Effect.die("not implemented: B-H")
    })
  })
)
