// The one gate for agents, the pre-push hook, and CI. Stops at the first failing step.
//
//   bun run verify                      scope = workspaces touched since origin/master
//   bun run verify --task tasks/X.md    + path guard: only the task's `allow` globs may change, `locked` files never
//   bun run verify --scope all          or a list: --scope be,fe
//   bun run verify --fast               skip Testcontainers tests and the fe build (pre-push)
import { Glob } from "bun"
import { parseArgs } from "node:util"

const { values: opt } = parseArgs({
  options: { task: { type: "string" }, scope: { type: "string" }, fast: { type: "boolean", default: false } }
})
const WORKSPACES = ["contract", "be", "fe"] as const
type Ws = (typeof WORKSPACES)[number]

const run = (cmd: string[], cwd = ".") => {
  const p = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe", env: { ...process.env, NO_COLOR: "1" } })
  // ast-grep's harmless "postinstall did not run" warning would only distract a model reading the output.
  const out = `${p.stdout}${p.stderr}`.replace(/^\[warn\] postinstall.*\n.*overhead\.\n?/m, "").trim()
  return { ok: p.exitCode === 0, out }
}

const fail = (step: string, out: string): never => {
  const lines = out.split("\n")
  console.log(`✗ ${step}\n${lines.slice(0, 80).join("\n")}${lines.length > 80 ? `\n… ${lines.length - 80} more lines` : ""}`)
  console.log(`\nFix the FIRST error above, then re-run: bun run verify ${process.argv.slice(2).join(" ")}`)
  process.exit(1)
}

const step = (name: string, cmd: string[], cwd = ".") => {
  const r = run(cmd, cwd)
  if (!r.ok) fail(name, r.out)
  console.log(`✓ ${name}`)
}

// Task file: YAML frontmatter with scope, allow, locked (see tasks/_template.md).
type Task = { scope?: string; allow?: string[]; locked?: string[] }
const task: Task | undefined = opt.task
  ? (Bun.YAML.parse((await Bun.file(opt.task).text()).split(/^---$/m)[1] ?? "") as Task)
  : undefined

// Files changed since the branch left master: committed, staged, unstaged, untracked.
const base = run(["git", "merge-base", "HEAD", "origin/master"])
const changed = base.ok
  ? [...new Set([
      ...run(["git", "diff", "--name-only", base.out]).out.split("\n"),
      ...run(["git", "ls-files", "--others", "--exclude-standard"]).out.split("\n")
    ])].filter(Boolean)
  : undefined // shallow clone (CI): no base, so no guard and scope = all

if (task) {
  if (!changed) fail("path guard", "cannot find merge-base with origin/master; run `git fetch origin master`")
  const allow = (task.allow ?? []).map((g) => new Glob(g))
  const locked = new Set(task.locked ?? [])
  const bad = (changed ?? []).flatMap((f) =>
    locked.has(f) ? [`${f}  locked: written by the decision thread, restore it with \`git checkout ${base.out} -- ${f}\``]
    : allow.some((g) => g.match(f)) ? []
    : [`${f}  outside the task's allow list; revert it, or report why the task needs it`]
  )
  if (bad.length) fail("path guard", bad.join("\n"))
  console.log("✓ path guard")
}

const derive = (): Ws[] => {
  if (!changed) return [...WORKSPACES]
  const touched = new Set<Ws>(task?.scope ? (task.scope.split(",") as Ws[]) : [])
  for (const f of changed) {
    const ws = WORKSPACES.find((w) => f.startsWith(`${w}/`))
    if (ws === "contract") return [...WORKSPACES] // both sides compile against it
    if (ws) touched.add(ws)
    else if (!/^(docs|tasks)\/|\.md$/.test(f)) return [...WORKSPACES] // root config, scripts, lint rules
  }
  return WORKSPACES.filter((w) => touched.has(w))
}
const scope: Ws[] = opt.scope === "all" ? [...WORKSPACES] : opt.scope ? (opt.scope.split(",") as Ws[]) : derive()
if (scope.length === 0) {
  console.log("✓ nothing to verify (docs/tasks only)")
  process.exit(0)
}
console.log(`scope: ${scope.join(", ")}${opt.fast ? " (fast)" : ""}`)

const tsc = `${process.cwd()}/node_modules/.bin/tsc`
step("lint (ast-grep, rules in lint/)", ["bun", "x", "ast-grep", "scan", "--report-style", "short"])
for (const ws of scope) step(`typecheck ${ws}`, [tsc, "-p", ws])
for (const ws of scope) {
  if (opt.fast && ws === "be") continue // Testcontainers: CI runs them
  const tests = [...new Glob("**/*.test.{ts,tsx}").scanSync({ cwd: ws })].filter((f) => !f.includes("node_modules"))
  if (tests.length) step(`test ${ws}`, ["bun", "test"], ws)
}
if (scope.includes("fe") && !opt.fast) step("build fe", ["bun", "run", "build"], "fe")
console.log("\nverify: all green")
