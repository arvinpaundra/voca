import { makeTestDb } from "./setup.ts"

/**
 * What every integration test builds its runtime from. Today only the database; the Google stub,
 * TestClock and seeded Random join it as the contexts that need them arrive.
 */
export const TestLayer = makeTestDb()
