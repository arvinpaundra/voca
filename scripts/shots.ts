// UI evidence for the definition of done: screenshots of the fe dev server, straight to files.
// No model reads them; the owner looks at them. Each spec is `route[:width][:dark]`:
//
//   bun scripts/shots.ts /login /login:390 /:1280:dark      → .shots/<route>-<width>[-dark].png
//
// First run downloads Chromium once (`bunx playwright install chromium`).
import { mkdirSync } from "node:fs"

const PORT = 5199
const specs = process.argv.slice(2)
if (specs.length === 0) {
  console.error("usage: bun scripts/shots.ts <route[:width][:dark]>...   e.g. /login /login:390 /:1280:dark")
  process.exit(1)
}

const server = Bun.spawn(["bun", "run", "dev", "--port", String(PORT), "--strictPort"], { cwd: "fe", stdout: "ignore", stderr: "ignore" })
const base = `http://localhost:${PORT}`
const up = async () => {
  for (let i = 0; i < 60; i++) {
    if (await fetch(base).then((r) => r.ok, () => false)) return true
    await Bun.sleep(500)
  }
  return false
}
if (!(await up())) {
  server.kill()
  console.error(`fe dev server did not answer on ${base} within 30 s`)
  process.exit(1)
}

mkdirSync(".shots", { recursive: true })
let failed = false
for (const spec of specs) {
  const [route = "/", ...opts] = spec.split(":")
  const width = Number(opts.find((o) => /^\d+$/.test(o)) ?? 1280)
  const dark = opts.includes("dark")
  const name = `${route.replace(/^\/|\/$/g, "").replace(/\//g, "_") || "home"}-${width}${dark ? "-dark" : ""}.png`
  const out = `.shots/${name}`
  const p = Bun.spawnSync([
    "bunx", "playwright", "screenshot", "--full-page", "--wait-for-timeout=800",
    `--viewport-size=${width},${width < 600 ? 844 : 800}`, `--color-scheme=${dark ? "dark" : "light"}`,
    `${base}${route}`, out
  ], { stdout: "pipe", stderr: "pipe" })
  if (p.exitCode === 0) console.log(`${process.cwd()}/${out}`)
  else {
    failed = true
    console.error(`✗ ${spec}: ${p.stderr.toString().trim().split("\n").slice(-3).join(" ")}`)
  }
}
server.kill()
process.exit(failed ? 1 : 0)
