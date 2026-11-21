import { Clock, Effect, Layer, Option } from "effect"
import { ImportTickets } from "../../application/importsPorts.ts"

const TICKET_TTL_MS = 30_000
const TICKET_BYTES = 32

interface Held {
  readonly learnerId: bigint
  readonly expiresAt: number
}

const randomTicket = (): string => {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(TICKET_BYTES))).toString("base64url")
}

/**
 * In memory: one API replica. A ticket is spent by its first redeem, whatever the answer, and it lives 30 seconds
 * from issue. Expired tickets are dropped when another one is issued, so unused ones don't pile up.
 */
export const ImportTicketsLive = Layer.effect(
  ImportTickets,
  Effect.sync(() => {
    const held = new Map<string, Held>()

    return ImportTickets.of({
      issue: (learnerId) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis

          for (const [ticket, entry] of held) {
            if (entry.expiresAt <= now) {
              held.delete(ticket)
            }
          }

          const ticket = randomTicket()

          held.set(ticket, { learnerId, expiresAt: now + TICKET_TTL_MS })

          return ticket
        }),

      redeem: (ticket) =>
        Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis
          const entry = held.get(ticket)

          held.delete(ticket)

          return entry !== undefined && entry.expiresAt > now ? Option.some(entry.learnerId) : Option.none()
        })
    })
  })
)
