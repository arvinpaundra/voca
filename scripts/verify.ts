import { Glob } from "bun"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { addedLines, check as checkCoverage, parseLcov, report as coverageReport } from "./diff-coverage.ts"
import { parseArgs } from "node:util"

const { values: opt } = parseArgs({
  options: { "print-locked": { type: "string", multiple: true }, body: { type: "string" }, issue: { type: "string" }, hash: { type: "string" }, "print-hash": { type: "boolean", default: false }, scope: { type: "string" }, fast: { type: "boolean", default: false } }
})
const WORKSPACES = ["contract", "be", "fe"] as const
type Ws = (typeof WORKSPACES)[number]

const run = (cmd: string[], cwd = ".") => {
  const p = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe", env: { ...process.env, NO_COLOR: "1" } })
  const out = `${p.stdout}${p.stderr}`.replace(/^\[warn\] postinstall.*\n.*overhead\.\n?/m, "").trim()
  return { ok: p.exitCode === 0, out }
}

const fail = (step: string, out: string): never => {
  writeFileSync(".verify-last.log", `${new Date().toISOString()} ✗ ${step}\n${out}\n`)
  const kept = out.split("\n").filter((line) => !/^\s+at |^\(pass\) |^##\[endgroup\]|^\s*$/.test(line))
  const header = (line?: string) => line !== undefined && /^(##\[group\])?\S+\.test\.tsx?:$/.test(line)
  const lines = kept.filter((line, i) => !header(line) || (i + 1 < kept.length && !header(kept[i + 1])))
  console.log(`✗ ${step}\n${lines.slice(0, 80).join("\n")}${lines.length > 80 ? `\n… ${lines.length - 80} more lines` : ""}`)
  console.log(`\nFix the FIRST error above, then re-run: bun run verify ${process.argv.slice(2).join(" ")}`)
  process.exit(1)
}

const fileHash = (path: string) => {
  const r = run(["git", "hash-object", path])
  return r.ok ? r.out.slice(0, 8) : "missing"
}
if (opt["print-locked"]) {
  for (const path of opt["print-locked"]) console.log(`  ${path}: ${fileHash(path)}`)
  process.exit(0)
}

const step = (name: string, cmd: string[], cwd = ".") => {
  const r = run(cmd, cwd)
  if (!r.ok) fail(name, r.out)
  console.log(`✓ ${name}`)
}

type Task = { scope?: string; allow?: string[]; locked?: Record<string, string> }
const loadTask = async (n: string): Promise<Task> => {
  const r = opt.body ? { ok: true, out: await Bun.file(opt.body).text() } : run(["gh", "issue", "view", n, "--json", "body", "-q", ".body"])
  if (!r.ok) fail("task issue", `cannot read issue #${n} (needs network and \`gh auth login\`):\n${r.out}`)
  const block = /```ya?ml\n([\s\S]*?)```/.exec(r.out)?.[1]
  if (!block) fail("task issue", `issue #${n} has no \`\`\`yaml limits block`)
  const hash = new Bun.CryptoHasher("sha256").update(block!.trim()).digest("hex").slice(0, 8)
  if (opt["print-hash"]) {
    console.log(hash)
    process.exit(0)
  }
  if (hash !== opt.hash) fail("task issue", `limits block of #${n} changed (hash ${hash}, dispatched ${opt.hash ?? "none"}). Do not edit the issue; report it.`)
  return Bun.YAML.parse(block!) as Task
}
const task: Task | undefined = opt.issue || opt.body ? await loadTask(opt.issue ?? opt.body!) : undefined

const base = run(["git", "merge-base", "HEAD", "origin/master"])
const changed = base.ok
  ? [...new Set([
      ...run(["git", "diff", "--name-only", base.out]).out.split("\n"),
      ...run(["git", "ls-files", "--others", "--exclude-standard"]).out.split("\n")
    ])].filter(Boolean)
  : undefined

if (task) {
  if (!changed) fail("path guard", "cannot find merge-base with origin/master; run `git fetch origin master`")
  const allow = (task.allow ?? []).map((g) => new Glob(g))
  const locked = task.locked ?? {}
  if (Array.isArray(locked)) fail("path guard", "`locked` must map each path to its content hash (`bun run verify --print-locked <path>`); report it")
  const bad = [
    ...Object.entries(locked).flatMap(([f, want]) =>
      fileHash(f) === String(want) ? [] : [`${f}  locked: its content differs from what the decision thread wrote; restore it, never edit it`]
    ),
    ...(changed ?? []).flatMap((f) =>
      f in locked || allow.some((g) => g.match(f)) ? [] : [`${f}  outside the task's allow list; revert it, or report why the task needs it`]
    )
  ]
  if (bad.length) fail("path guard", bad.join("\n"))
  console.log("✓ path guard")
}

const derive = (): Ws[] => {
  if (!changed) return [...WORKSPACES]
  const touched = new Set<Ws>(task?.scope ? (task.scope.split(",") as Ws[]) : [])
  for (const f of changed) {
    const ws = WORKSPACES.find((w) => f.startsWith(`${w}/`))
    if (ws === "contract") return [...WORKSPACES]
    if (ws) touched.add(ws)
    else if (!/^docs\/|\.md$/.test(f)) return [...WORKSPACES]
  }
  return WORKSPACES.filter((w) => touched.has(w))
}
const scope: Ws[] = opt.scope === "all" ? [...WORKSPACES] : opt.scope ? (opt.scope.split(",") as Ws[]) : derive()
if (scope.length === 0) {
  console.log("✓ nothing to verify (docs only)")
  process.exit(0)
}
console.log(`scope: ${scope.join(", ")}${opt.fast ? " (fast)" : ""}`)

const tsc = `${process.cwd()}/node_modules/.bin/tsc`
step("lint (ast-grep, rules in lint/)", ["bun", "x", "ast-grep", "scan", "--report-style", "short"])
for (const ws of scope) step(`typecheck ${ws}`, [tsc, "-p", ws])
const coverageDir = (ws: Ws) => `/tmp/voca-coverage/${ws}`
const covered: Array<Ws> = []
for (const ws of scope) {
  if (opt.fast && ws === "be") continue
  const tests = [...new Glob("**/*.test.{ts,tsx}").scanSync({ cwd: ws })].filter((f) => !f.includes("node_modules"))
  if (!tests.length) continue

  const coverage = task ? ["--coverage", "--coverage-reporter=lcov", `--coverage-dir=${coverageDir(ws)}`] : []
  step(`test ${ws}`, ["bun", "test", ...coverage], ws)
  if (task) covered.push(ws)
}

if (task && base.ok && covered.length) {
  const added = addedLines(run(["git", "diff", "-U0", base.out]).out)
  for (const f of run(["git", "ls-files", "--others", "--exclude-standard"]).out.split("\n").filter(Boolean)) {
    added.set(f, readFileSync(f, "utf8").split("\n").map((_, i) => i + 1))
  }

  for (const f of added.keys()) {
    if (!covered.some((ws) => f.startsWith(`${ws}/`))) added.delete(f)
  }

  const coverage = new Map(covered.flatMap((ws) => {
    const lcov = `${coverageDir(ws)}/lcov.info`
    return existsSync(lcov) ? [...parseLcov(readFileSync(lcov, "utf8"), ws)] : []
  }))

  const result = checkCoverage(added, coverage)
  if (!result.ok) fail("diff coverage", coverageReport(result))
  console.log(`✓ diff coverage (${coverageReport(result)})`)
}
if (scope.includes("fe") && !opt.fast) step("build fe", ["bun", "run", "build"], "fe")
console.log("\nverify: all green")
