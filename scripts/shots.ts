// UI evidence for the definition of done: screenshots of the fe dev server, straight to files in .shots/.
// Each spec is `route[:width][:dark][:state]`:
//
//   bun scripts/shots.ts /login /login:390 /:1280:dark                 public pages
//   bun scripts/shots.ts --mock /app /app/decks /app/study::wrong      signed-in pages against a fake /api
//   bun scripts/shots.ts --design                                      every screen of the Console design
//
// --mock signs in with a fake refresh token and answers /api/* from scripts/shots-fixtures.ts (the design's sample
// data), with the clock frozen on the design's date. States: `complete` (a finished session), `wrong` (press 1 on
// the question, which the fake API marks wrong). --design writes .shots/design-<screen>.png for side-by-side checks.
// First run downloads Chromium once (`bunx playwright install chromium`).
import { mkdirSync } from "node:fs"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import { chromium, type Page } from "playwright-core"
import { NOW, TIMEZONE, routes } from "./shots-fixtures"

const { values: opt, positionals: specs } = parseArgs({
  allowPositionals: true,
  options: { mock: { type: "boolean", default: false }, design: { type: "boolean", default: false } },
})

const DESIGN_SCREENS = [
  "dashboard", "decks", "deck", "setup", "complete", "session", "discover", "preview", "settings", "login", "landing",
]

if (specs.length === 0 && !opt.design) {
  console.error("usage: bun scripts/shots.ts [--mock] <route[:width][:dark][:state]>...  |  bun scripts/shots.ts --design")
  process.exit(1)
}

mkdirSync(".shots", { recursive: true })
const browser = await chromium.launch()

if (opt.design) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(`file://${resolve("docs/design/ui-refinement.html")}#console`)
  await page.waitForTimeout(1000)

  // The sticky option picker would sit on top of the screens.
  await page.addStyleTag({ content: ".doc-top { display: none !important; }" })

  const screens = await page.$$(".screen")
  for (const [i, screen] of screens.entries()) {
    const out = `.shots/design-${DESIGN_SCREENS[i] ?? i}.png`
    await screen.screenshot({ path: out })
    console.log(resolve(out))
  }

  await browser.close()
  process.exit(0)
}

const PORT = 5199
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
  await browser.close()
  console.error(`fe dev server did not answer on ${base} within 30 s`)
  process.exit(1)
}

const fakeApi = async (page: Page, state: string, problems: string[]) => {
  await page.clock.setFixedTime(new Date(NOW))
  await page.addInitScript(() => localStorage.setItem("voca.refreshToken", "A".repeat(43)))
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url())
    const hit = routes.find(([path]) => path.test(url.pathname))
    if (hit === undefined) {
      problems.push(`no fixture for ${route.request().method()} ${url.pathname}`)
      return route.fulfill({ status: 404, body: "" })
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(hit[1](url, state)) })
  })
}

let failed = false
for (const spec of specs) {
  const [route = "/", ...parts] = spec.split(":")
  const width = Number(parts.find((p) => /^\d+$/.test(p)) ?? 1280)
  const dark = parts.includes("dark")
  const state = parts.find((p) => p !== "" && p !== "dark" && !/^\d+$/.test(p)) ?? ""

  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 800 },
    colorScheme: dark ? "dark" : "light",
    ...(opt.mock ? { timezoneId: TIMEZONE } : {}),
  })
  const page = await context.newPage()
  const problems: string[] = []
  page.on("pageerror", (error) => problems.push(String(error)))
  if (opt.mock) await fakeApi(page, state, problems)

  await page.goto(`${base}${route}`)
  await page.waitForTimeout(800)
  if (state === "wrong") {
    await page.keyboard.press("1")
    await page.waitForTimeout(400)
  }

  const suffix = `${dark ? "-dark" : ""}${state ? `-${state}` : ""}`
  const name = `${route.replace(/^\/|\/$/g, "").replace(/\//g, "_") || "home"}-${width}${suffix}.png`
  const out = `.shots/${name}`
  await page.screenshot({ path: out, fullPage: true })
  await context.close()

  if (problems.length > 0) {
    failed = true
    console.error(`✗ ${spec}: ${problems.join(" | ")}`)
  }
  console.log(resolve(out))
}

server.kill()
await browser.close()
process.exit(failed ? 1 : 0)
