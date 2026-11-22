import { Effect, Layer, PubSub, Stream } from "effect"
import type { ImportEvent } from "@voca/contract"
import { ImportNotifier } from "../../application/importsPorts.ts"

interface Notice {
  readonly learnerId: bigint
  readonly event: ImportEvent
}

/**
 * In memory, so one API replica serves the streams: every notice goes to every open stream, and each stream keeps
 * only its Learner's events.
 */
export const ImportNotifierLive = Layer.effect(
  ImportNotifier,
  Effect.gen(function* () {
    const pubsub = yield* PubSub.unbounded<Notice>()

    return ImportNotifier.of({
      publish: (learnerId, event) => PubSub.publish(pubsub, { learnerId, event }).pipe(Effect.asVoid),
      events: (learnerId) =>
        Stream.fromPubSub(pubsub).pipe(
          Stream.filter((notice) => notice.learnerId === learnerId),
          Stream.map((notice) => notice.event)
        )
    })
  })
)
