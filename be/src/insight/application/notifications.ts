import { Effect } from "effect"
import { CurrentLearner, drillLabel, type Notifications } from "@voca/contract"
import { learnerCalendar } from "./calendar.ts"
import { InsightRepo } from "./insightRepo.ts"

type NotificationDeck = Notifications["decks"][number]

/** `GET /notifications`: the Learner's decks with due cards, most overdue first, and the hard and new counts. */
export const notifications = Effect.gen(function* () {
  const { id: learnerId } = yield* CurrentLearner
  const repo = yield* InsightRepo
  const calendar = yield* learnerCalendar(learnerId)
  const rows = yield* repo.dueByDeck(learnerId, calendar.day.start, calendar.day.end)
  const newToday = yield* repo.newReviewsBetween(learnerId, calendar.day.start, calendar.day.end)

  const decks = new Map<string, NotificationDeck>()

  for (const row of rows) {
    const deck = decks.get(row.deckSlug) ?? {
      deckSlug: row.deckSlug,
      title: row.title,
      due: 0,
      overdue: 0,
      byDrill: []
    }

    decks.set(row.deckSlug, {
      ...deck,
      due: deck.due + row.due,
      overdue: deck.overdue + row.overdue,
      byDrill: [
        ...deck.byDrill,
        { drill: row.drill, label: drillLabel(row.termLang, row.drill), due: row.due }
      ]
    })
  }

  const newAvailable: number = yield* Effect.die("not implemented: QUEUE")
  const estimatedMinutes: number | null = yield* Effect.die("not implemented: QUEUE")

  return {
    decks: [...decks.values()].sort((a, b) => b.overdue - a.overdue || b.due - a.due),
    hardDue: rows.reduce((sum, row) => sum + row.hard, 0),
    newAvailable,
    estimatedMinutes
  }
})
