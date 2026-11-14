import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { Cause, Effect, Exit, Random } from "effect"
import { LearnerRepo } from "../src/identity/application/ports.ts"
import { newLearnerSlug } from "../src/identity/infrastructure/learnerRepo.ts"
import { at, makeIdentityRuntime, seedLearner } from "./identity.ts"
import { resetDb } from "./setup.ts"

// A new Learner's slug is random. When it hits an existing one, the insert is retried once with the next slug;
// a second hit in a row is a defect. A seeded Random makes the slugs known in advance.

const SEED = "voca-slug-collision"

const rt = makeIdentityRuntime()
afterAll(() => rt.dispose())
beforeEach(() => rt.runPromise(Effect.andThen(resetDb, at("2026-11-14T00:00:00Z"))))

/** The first `n` slugs the seeded generator produces, in order. */
const seededSlugs = (n: number) =>
  Effect.forEach(Array.from({ length: n }), () => newLearnerSlug).pipe(Random.withSeed(SEED))

const ada = { sub: "g-ada", email: "ada@example.com", name: "Ada", avatarUrl: null }

const signUpAda = LearnerRepo.pipe(
  Effect.flatMap((repo) => repo.upsertGoogle(ada, "UTC")),
  Random.withSeed(SEED)
)

describe("newLearnerSlug", () => {
  test("is 8 Crockford characters, and the same seed gives the same sequence", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const first = yield* seededSlugs(3)
        const again = yield* seededSlugs(3)

        expect(again).toEqual(first)
        expect(new Set(first).size).toBe(3)
        for (const slug of first) expect(slug).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/)
      })
    ))
})

describe("signing up when the slug is taken", () => {
  test("one collision: the insert is retried with the next slug and succeeds", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const [taken, next] = yield* seededSlugs(2)
        yield* seedLearner(taken!, "g-someone-else")

        const learner = yield* signUpAda

        expect(String(learner.slug)).toBe(next!)
        expect(learner.email).toBe("ada@example.com")
      })
    ))

  test("two collisions in a row: a defect, and nothing is written for Ada", () =>
    rt.runPromise(
      Effect.gen(function* () {
        const [first, second] = yield* seededSlugs(2)
        yield* seedLearner(first!, "g-someone-else")
        yield* seedLearner(second!, "g-someone-else-2")

        const exit = yield* Effect.exit(signUpAda)

        expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true)
        const repo = yield* LearnerRepo
        const learners = yield* Effect.forEach([first!, second!], (slug) => repo.findBySlug(slug as never))
        expect(learners.every((found) => found._tag === "Some" && found.value.email !== "ada@example.com")).toBe(true)
      })
    ))
})
