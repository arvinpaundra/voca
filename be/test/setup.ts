import { PgClient } from "@effect/sql-pg"
import { Config, Effect, Layer, Redacted } from "effect"
import { Reactivity } from "effect/reactivity"
import { SqlClient } from "effect/sql"
import { migrate } from "../migrations/index.ts"

let counter = 0

/**
 * A fresh, fully migrated database inside the shared container, dropped when the layer is released.
 * One per test file: `const rt = ManagedRuntime.make(TestDb); afterAll(() => rt.dispose())`.
 */
export const makeTestDb = () =>
  Layer.unwrap(
    Effect.gen(function* () {
      const adminUrl = yield* Config.String("TEST_PG_ADMIN_URL")
      const name = `voca_test_${process.pid}_${counter++}`
      const admin = yield* PgClient.make({ url: Redacted.make(adminUrl) }).pipe(Effect.provide(Reactivity.layer))
      yield* admin`CREATE DATABASE ${admin(name)}`
      yield* Effect.addFinalizer(() =>
        admin`DROP DATABASE IF EXISTS ${admin(name)} WITH (FORCE)`.pipe(Effect.ignore)
      )
      const url = new URL(adminUrl)
      url.pathname = `/${name}`
      const pg = PgClient.layer({ url: Redacted.make(url.toString()), maxConnections: 5 })
      // migrate needs the pool, and the pool must also reach the tests: provide it and keep its outputs.
      return Layer.effectDiscard(migrate).pipe(Layer.provideMerge(pg))
    })
  )

/** Empties every table, restarting identities. Call in `beforeEach` so tests don't see each other's rows. */
export const resetDb = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  const tables = yield* sql<{ readonly tablename: string }>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'effect_sql_%'`
  if (tables.length === 0) return
  const names = tables.map((t) => `"${t.tablename}"`).join(", ") // names come from pg_tables, not from input
  yield* sql.unsafe(`TRUNCATE ${names} RESTART IDENTITY CASCADE`)
})
