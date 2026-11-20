import { Effect } from "effect"
import { SqlClient } from "effect/sql"

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // snoozed_at set and snoozed_until NULL: snoozed until the Learner unsnoozes.
  // snoozed_until in the past: the snooze is over, and reads treat the deck as awake.
  yield* sql`ALTER TABLE decks ADD COLUMN snoozed_at timestamptz`
  yield* sql`ALTER TABLE decks ADD COLUMN snoozed_until timestamptz`
})
