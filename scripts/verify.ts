// The one gate for agents, the pre-push hook, and CI. Stops at the first failing step.
//
//   bun run verify                      scope = workspaces touched since origin/master
//   bun run verify --issue 12 --sha 3fa9c1d2   + path guard: only the issue's `allow` globs may change, `locked` files never
//   bun run verify --issue 12 --print-sha      prints the sha of the issue's limits block (the dispatcher puts it in the task message)
//   bun run verify --scope all          or a list: --scope be,fe
//   bun run verify --fast               skip Testcontainers tests and the fe build (pre-push)
import { Glob } from "bun"
import { parseArgs } from "node:util"

const { values: opt } = parseArgs({
  options: { issue: { type: "string" }, sha: { type: "string" }, "print-sha": { type: "boolean", default: false }, scope: { type: "string" }, fast: { type: "boolean", default: false } }
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

// Task = a GitHub issue whose body has one ```yaml block with scope, allow, locked (see .github/ISSUE_TEMPLATE/task.md).
// The dispatcher passes the block's sha; an edited block (a worker widening its own limits) fails the check.
type Task = { scope?: string; allow?: string[]; locked?: string[] }
const loadTask = async (n: string): Promise<Task> => {
  const r = run(["gh", "issue", "view", n, "--json", "body", "-q", ".body"])
  if (!r.ok) fail("task issue", `cannot read issue #${n} (needs network and \`gh auth login\`):\n${r.out}`)
  const block = /```ya?ml\n([\s\S]*?)```/.exec(r.out)?.[1]
  if (!block) fail("task issue", `issue #${n} has no \`\`\`yaml limits block`)
  const sha = new Bun.CryptoHasher("sha256").update(block!.trim()).digest("hex").slice(0, 8)
  if (opt["print-sha"]) {
    console.log(sha)
    process.exit(0)
  }
  if (sha !== opt.sha) fail("task issue", `limits block of #${n} changed (sha ${sha}, dispatched ${opt.sha ?? "none"}). Do not edit the issue; report it.`)
  return Bun.YAML.parse(block!) as Task
}
const task: Task | undefined = opt.issue ? await loadTask(opt.issue) : undefined

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
    else if (!/^docs\/|\.md$/.test(f)) return [...WORKSPACES] // root config, scripts, lint rules
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
for (const ws of scope) {
  if (opt.fast && ws === "be") continue // Testcontainers: CI runs them
  const tests = [...new Glob("**/*.test.{ts,tsx}").scanSync({ cwd: ws })].filter((f) => !f.includes("node_modules"))
  if (tests.length) step(`test ${ws}`, ["bun", "test"], ws)
}
if (scope.includes("fe") && !opt.fast) step("build fe", ["bun", "run", "build"], "fe")
console.log("\nverify: all green")
