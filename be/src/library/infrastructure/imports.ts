import { Effect, Layer } from "effect"
import type { SqlClient } from "effect/sql"
import type { Transaction } from "../../shared/transaction.ts"
import type { DeckRepo } from "../application/deckRepo.ts"
import { ImportBatches, ImportNotifier, ImportQueue, ImportTickets } from "../application/importsPorts.ts"
import type { WordRepo } from "../application/wordRepo.ts"
import { ImportBatchesLive } from "./importsRepo.ts"
import { ImportNotifierLive } from "./imports/notifier.ts"
import { ImportQueueLive } from "./imports/queue.ts"
import { ImportTicketsLive } from "./imports/tickets.ts"
import { runWorker } from "./imports/worker.ts"

/** Where the import jobs go: one tube per environment (tests use one per file). */
export interface ImportsOptions {
  readonly host: string
  readonly port: number
  readonly tube: string
}

/**
 * Everything the imports endpoints stand on: the batch store, the beanstalkd producer, the event PubSub, the stream
 * tickets, and the worker fiber that imports each file. The worker is forked in the layer's scope, so it stops when
 * the layer does.
 */
export const ImportsLive = (
  options: ImportsOptions
): Layer.Layer<
  ImportBatches | ImportNotifier | ImportQueue | ImportTickets,
  never,
  SqlClient.SqlClient | DeckRepo | WordRepo | Transaction
> => {
  const services = Layer.mergeAll(
    ImportBatchesLive,
    ImportNotifierLive,
    ImportTicketsLive,
    ImportQueueLive(options)
  )

  const worker = Layer.effectDiscard(Effect.forkScoped(runWorker(options)))

  return worker.pipe(Layer.provideMerge(services))
}
