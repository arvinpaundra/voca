import { Migrator } from "effect/sql"
import * as Init from "./0001_init.ts"

// Registered explicitly because Bun's `import.meta.glob` doesn't resolve at build time.
export const loader = Migrator.fromRecord({
  "0001_init": Init.default
})

/** Applies every pending migration. Needs a `SqlClient` in context. */
export const migrate = Migrator.make({})({ loader })
