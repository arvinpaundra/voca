// Once per `bun test` run: start one Postgres (same image as production) shared by every test file.
// Each file gets its own database in it (setup.ts). macOS Podman needs `podman machine start` first.
//
// Under Bun, Testcontainers' default log-based wait strategies never complete (same as in the `bean` repo),
// so readiness is a real query over TCP: `pg_isready` is true during initdb's temporary server, a TCP query is not.
import "./runtime.ts"
import { afterAll } from "bun:test"
import { SQL } from "bun"
import { PgClient } from "@effect/sql-pg"
import { Effect, Redacted } from "effect"
import { GenericContainer, getContainerRuntimeClient, type WaitStrategy } from "testcontainers"
import { migrate } from "../migrations/index.ts"
import { TEMPLATE_DB } from "./setup.ts"

const TIMEOUT_MS = 60_000

class QueryWait implements WaitStrategy {
  withStartupTimeout(): WaitStrategy {
    return this
  }
  isStartupTimeoutSet(): boolean {
    return true
  }
  getStartupTimeout(): number {
    return TIMEOUT_MS
  }
  async waitUntilReady(_container: unknown, boundPorts: { getFirstBinding(): number }): Promise<void> {
    const host = (await getContainerRuntimeClient()).info.containerRuntime.host
    const url = `postgres://postgres:voca@${host}:${boundPorts.getFirstBinding()}/postgres`
    const deadline = Date.now() + TIMEOUT_MS
    while (Date.now() < deadline) {
      const probe = new SQL(url)
      const ok = await probe.unsafe("SELECT 1").then(() => true, () => false)
      await probe.close()
      if (ok) return
      await Bun.sleep(250)
    }
    return Promise.reject(new Error(`Postgres did not accept connections within ${TIMEOUT_MS / 1000}s`))
  }
}

// With Ryuk off, a killed run leaves its container behind. Each carries its owner's pid; remove those whose owner is gone.
const cli = Bun.which("podman") ?? Bun.which("docker")
for (const line of Bun.spawnSync([cli ?? "false", "ps", "-a", "--filter", "label=voca-test", "--format", '{{.ID}} {{index .Labels "voca-test"}}'])
  .stdout.toString()
  .split("\n")
  .filter(Boolean)) {
  const [id = "", pid = ""] = line.split(" ")
  if (Bun.spawnSync(["kill", "-0", pid]).exitCode !== 0) Bun.spawnSync([cli ?? "false", "rm", "-f", id])
}

const container = await new GenericContainer("postgres:18.3-alpine")
  .withEnvironment({ POSTGRES_PASSWORD: "voca" })
  .withExposedPorts(5432)
  .withLabels({ "voca-test": String(process.pid) })
  .withWaitStrategy(new QueryWait())
  .start()
  .catch((cause: unknown) => {
    console.error("Could not start Postgres. Is a container runtime running? macOS Podman: `podman machine start`.\n", cause)
    return process.exit(1)
  })

const server = `postgres://postgres:voca@${container.getHost()}:${container.getMappedPort(5432)}`
process.env.TEST_PG_ADMIN_URL = `${server}/postgres`
afterAll(() => container.stop())

// Migrate once, into a template; each test file then copies it (setup.ts). The slow part (migrations, and the first
// round trips to a just-woken Podman VM) happens here, outside the per-test timeout.
const admin = new SQL(`${server}/postgres`)
await admin.unsafe(`CREATE DATABASE ${TEMPLATE_DB}`)
await admin.close()
await Effect.runPromise(
  migrate.pipe(Effect.provide(PgClient.layer({ url: Redacted.make(`${server}/${TEMPLATE_DB}`), maxConnections: 1 })))
)
process.on("SIGINT", () => process.exit(130)) // the sweep above removes what a killed run leaves behind
