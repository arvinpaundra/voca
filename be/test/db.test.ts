import { afterAll, beforeEach, expect, test } from "bun:test"
import { Effect, ManagedRuntime } from "effect"
import { SqlClient } from "effect/sql"
import { TestLayer } from "./layers.ts"
import { resetDb } from "./setup.ts"

const rt = ManagedRuntime.make(TestLayer)
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(resetDb))

test("the database is migrated", () =>
  rt.runPromise(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const rows = yield* sql<{ readonly t: string | null }>`SELECT to_regclass('public.learners')::text AS t`
      expect(rows[0]?.t).toBe("learners")
    })
  ))

const insertLearner = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`INSERT INTO learners (slug, google_sub, email, name, timezone, day_start_hour, desired_retention,
      new_per_day, default_session_size, default_mode, created_at)
    VALUES ('ABCDEFGH', 'sub-1', 'a@b.c', 'A', 'UTC', 4, 0.9, 20, 10, 'easy', now())`
  const [row] = yield* sql<{ readonly n: string }>`SELECT count(*)::text AS n FROM learners`
  return Number(row?.n)
})

test("resetDb empties the tables between tests (1/2)", () =>
  rt.runPromise(insertLearner.pipe(Effect.map((n) => expect(n).toBe(1)))))

test("resetDb empties the tables between tests (2/2)", () =>
  rt.runPromise(insertLearner.pipe(Effect.map((n) => expect(n).toBe(1)))))
