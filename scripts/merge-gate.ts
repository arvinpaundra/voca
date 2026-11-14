// May the decision thread merge this PR itself? `bun scripts/merge-gate.ts <pr>` prints `merge: ok`, or the reasons the
// owner has to merge it (docs/agents/loop.md "Merging"). Rules 1-4 are checked here; rule 5 (the worker's report
// flags nothing) is the dispatcher's own check. Exit 0 = ok, 1 = needs the owner.

/** Paths whose mistakes are expensive or silent: the FE↔BE contract, schema, auth, the guards themselves, dependencies. */
export const CRITICAL = [
  "contract/**", "be/migrations/**", "be/src/identity/**", "be/src/shared/**",
  "lint/**", "scripts/**", ".github/**", ".githooks/**", ".claude/**",
  "AGENTS.md", "docs/13-decisions.md", "package.json", "**/package.json", "bun.lock"
]
export const MAX_FILES = 8
export const MAX_LINES = 300

export interface PrFacts {
  readonly ciGreen: boolean // the `verify` check succeeded on the current head
  readonly behindMaster: number // commits on master the branch doesn't have
  readonly linkedTaskIssue: boolean // linked to an issue labelled `task`, so CI ran the path guard
  readonly files: ReadonlyArray<{ readonly path: string; readonly lines: number }>
  readonly locked: ReadonlyArray<string> // the task's locked tests: written by the dispatcher, not counted in the size
}

export const assess = (pr: PrFacts): Array<string> => {
  const reasons: Array<string> = []
  if (!pr.ciGreen) reasons.push("1. CI `verify` is not green on the current head")
  if (pr.behindMaster > 0) reasons.push(`1. the branch is ${pr.behindMaster} commit(s) behind master: rebase first`)
  const critical = pr.files.filter((f) => CRITICAL.some((g) => new Bun.Glob(g).match(f.path)))
  if (critical.length) reasons.push(`3. touches critical paths: ${critical.map((f) => f.path).join(", ")}`)
  const counted = pr.files.filter((f) => !pr.locked.includes(f.path))
  const lines = counted.reduce((n, f) => n + f.lines, 0)
  if (counted.length > MAX_FILES) reasons.push(`4. ${counted.length} files (max ${MAX_FILES})`)
  if (lines > MAX_LINES) reasons.push(`4. ${lines} changed lines (max ${MAX_LINES})`)
  return reasons
}

const gh = (...args: Array<string>) => {
  const p = Bun.spawnSync(["gh", ...args], { stdout: "pipe", stderr: "pipe" })
  if (p.exitCode !== 0) {
    console.error(`gh ${args.join(" ")} failed:\n${p.stderr}`)
    process.exit(2)
  }
  return p.stdout.toString()
}

if (import.meta.main) {
  const n = process.argv[2]
  if (!n) {
    console.error("usage: bun scripts/merge-gate.ts <pr number>")
    process.exit(2)
  }
  type Pr = {
    headRefOid: string
    baseRefName: string
    statusCheckRollup: Array<{ name?: string; conclusion?: string }>
    closingIssuesReferences: Array<{ number: number }>
    files: Array<{ path: string; additions: number; deletions: number }>
  }
  const pr = JSON.parse(gh("pr", "view", n, "--json", "headRefOid,baseRefName,statusCheckRollup,closingIssuesReferences,files")) as Pr
  const behind = Number(gh("api", `repos/{owner}/{repo}/compare/${pr.baseRefName}...${pr.headRefOid}`, "-q", ".behind_by").trim())

  // The linked task issue, if any: its `locked` paths (yaml block) don't count toward the size.
  let linkedTaskIssue = false
  const locked: Array<string> = []
  for (const { number } of pr.closingIssuesReferences) {
    const issue = JSON.parse(gh("issue", "view", String(number), "--json", "labels,body")) as { labels: Array<{ name: string }>; body: string }
    if (!issue.labels.some((l) => l.name === "task")) continue
    linkedTaskIssue = true
    const block = /```ya?ml\n([\s\S]*?)```/.exec(issue.body)?.[1] ?? ""
    const parsed = Bun.YAML.parse(block) as { locked?: Record<string, string> }
    locked.push(...Object.keys(parsed?.locked ?? {}))
  }

  const reasons = assess({
    ciGreen: pr.statusCheckRollup.some((c) => c.name === "verify" && c.conclusion === "SUCCESS"),
    behindMaster: behind,
    linkedTaskIssue,
    files: pr.files.map((f) => ({ path: f.path, lines: f.additions + f.deletions })),
    locked
  })
  console.log(reasons.length ? `merge: needs the owner\n${reasons.map((r) => `  - ${r}`).join("\n")}` : "merge: ok")
  process.exit(reasons.length ? 1 : 0)
}
