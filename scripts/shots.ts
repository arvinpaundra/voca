import { mkdirSync } from "node:fs"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import { chromium, type Page } from "playwright-core"
import { NO_CONTENT, NOW, TIMEZONE, routes } from "./shots-fixtures"

const { values: opt, positionals: specs } = parseArgs({
  allowPositionals: true,
  options: { mock: { type: "boolean", default: false }, design: { type: "boolean", default: false } },
})

const DESIGN_SCREENS = [
  "dashboard", "decks", "deck", "setup", "complete", "session", "discover", "preview", "settings", "login", "landing",
  "word", "hard", "session-words",
]

if (specs.length === 0 && !opt.design) {
  console.error("usage: bun scripts/shots.ts [--mock] <route[:width|:WxH][:dark][:state]>...  |  bun scripts/shots.ts --design")
  process.exit(1)
}

mkdirSync(".shots", { recursive: true })
const browser = await chromium.launch()

if (opt.design) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(`file://${resolve("docs/design/ui-refinement.html")}#console`)
  await page.waitForTimeout(1000)

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
    const body = hit[1](url, state, route.request().method())
    if (body === NO_CONTENT) return route.fulfill({ status: 204, body: "" })
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) })
  })
}

let failed = false
for (const spec of specs) {
  const [route = "/", ...parts] = spec.split(":")
  const viewport = parts.find((p) => /^\d+x\d+$/.test(p))?.split("x").map(Number)
  const width = viewport?.[0] ?? Number(parts.find((p) => /^\d+$/.test(p)) ?? 1280)
  const height = viewport?.[1] ?? (width < 600 ? 844 : 800)
  const dark = parts.includes("dark")
  const state = parts.find((p) => p !== "" && p !== "dark" && !/^\d+(x\d+)?$/.test(p)) ?? ""

  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: dark ? "dark" : "light",
    ...(opt.mock ? { timezoneId: TIMEZONE } : {}),
  })
  const page = await context.newPage()
  const problems: string[] = []
  page.on("pageerror", (error) => problems.push(String(error)))
  if (opt.mock) await fakeApi(page, state, problems)

  await page.goto(`${base}${route}`)
  await page.waitForTimeout(800)
  if (state === "wrong" || state === "long60") {
    await page.keyboard.press("1")
    await page.waitForTimeout(400)
  }
  if (state === "select") {
    await page.getByRole("button", { name: "Select", exact: true }).click()
    await page.getByRole("checkbox").first().check()
    await page.waitForTimeout(300)
  }
  if (state === "finish") {
    await page.keyboard.press("2")
    await page.waitForTimeout(400)
    await page.keyboard.press("Enter")
    await page.waitForTimeout(400)
  }

  const suffix = `${dark ? "-dark" : ""}${state ? `-${state}` : ""}`
  const name = `${route.replace(/^\/|\/$/g, "").replace(/\//g, "_") || "home"}-${width}${suffix}.png`
  const out = `.shots/${name}`
  await page.screenshot({ path: out, fullPage: viewport === undefined })
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
