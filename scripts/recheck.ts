// After a workflow: the independent re-check of each task PR, without an agent. CI already re-ran the full gate on the
// pushed code (with the path guard, because the PR is linked to its task issue); this reads that result and looks for
// stubs left in the files the PR changed.
//
//   bun scripts/recheck.ts 60 61 62

interface Pr {
  readonly headRefName: string
  readonly headRefOid: string
  readonly statusCheckRollup: ReadonlyArray<{ readonly name?: string; readonly conclusion?: string; readonly status?: string }>
  readonly closingIssuesReferences: ReadonlyArray<{ readonly number: number }>
  readonly files: ReadonlyArray<{ readonly path: string }>
}

const run = (cmd: Array<string>) => {
  const result = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" })
  return { ok: result.exitCode === 0, out: `${result.stdout}`.trim() }
}

const isTaskIssue = (issue: number) =>
  run(["gh", "issue", "view", String(issue), "--json", "labels", "-q", ".labels[].name"]).out.split("\n").includes("task")

/** What keeps the PR from being done; empty when it is. `next.ts` routes on the same list. */
export const recheck = (pr: string): Array<string> => {
  const view = run(["gh", "pr", "view", pr, "--json", "headRefName,headRefOid,statusCheckRollup,closingIssuesReferences,files"])
  if (!view.ok) return [`cannot read PR #${pr}`]

  const info = JSON.parse(view.out) as Pr
  const problems: Array<string> = []

  const verify = info.statusCheckRollup.find((check) => check.name === "verify")
  if (verify?.conclusion !== "SUCCESS") {
    problems.push(`CI verify is ${verify?.conclusion ?? verify?.status ?? "missing"}`)
  }

  const linked = info.closingIssuesReferences.some((issue) => isTaskIssue(issue.number))
  if (!linked) problems.push("not linked to a task issue, so CI skipped the path guard")

  run(["git", "fetch", "-q", "origin", info.headRefName])
  const paths = info.files.map((file) => file.path).filter((path) => !/\.test\.tsx?$/.test(path))
  const stubs = paths.length === 0
    ? ""
    : run(["git", "grep", "-n", "not implemented:", info.headRefOid, "--", ...paths]).out

  if (stubs !== "") problems.push(`stubs left:\n${stubs}`)

  return problems
}

if (import.meta.main) {
  const prs = process.argv.slice(2)
  if (prs.length === 0) {
    console.error("usage: bun scripts/recheck.ts <PR number>...")
    process.exit(2)
  }

  let failed = false

  for (const pr of prs) {
    const problems = recheck(pr)

    if (problems.length === 0) {
      console.log(`✓ #${pr}`)
    } else {
      failed = true
      console.log(`✗ #${pr}\n${problems.map((problem) => `  - ${problem}`).join("\n")}`)
    }
  }

  process.exit(failed ? 1 : 0)
}
