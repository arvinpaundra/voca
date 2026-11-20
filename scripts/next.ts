// After a dispatch: the next step for each task PR, decided by rules, not by a model. Combines the re-check, the
// merge gate, the worker's reply, the first CI error and the repair round count. Runs the rebases itself and writes
// the repairs as a ready dispatch file.
//
//   bun scripts/next.ts --feature <name> 60 61 62
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { parseArgs } from "node:util"
import type { Heal, Reply } from "./dispatch.ts"
import { assess, prFacts } from "./merge-gate.ts"
import { recheck } from "./recheck.ts"

export type Action =
  | { readonly kind: "wait" }
  | { readonly kind: "owner"; readonly why: string }
  | { readonly kind: "stopped" }
  | { readonly kind: "heal"; readonly finding: string; readonly files: ReadonlyArray<string> }
  | { readonly kind: "rebase" }
  | { readonly kind: "merge" }

export interface Facts {
  readonly ci: "pending" | "success" | "failure"
  readonly conflicting: boolean
  /** recheck's list, without the CI line (that's `ci`). */
  readonly problems: ReadonlyArray<string>
  /** merge-gate's reasons. */
  readonly reasons: ReadonlyArray<string>
  readonly reply: Reply | undefined
  /** Repair rounds already run on this PR. */
  readonly rounds: number
  /** The first error of the failed CI run, when `ci` is "failure". */
  readonly failure: { readonly finding: string; readonly files: ReadonlyArray<string> } | undefined
}

const MAX_ROUNDS = 4

export const route = (f: Facts): Action => {
  if (f.reply?.disputed) return { kind: "owner", why: `disputed: ${f.reply.disputed}` }
  if (f.reply?.couldNotDo) return { kind: "owner", why: `couldNotDo: ${f.reply.couldNotDo}` }
  if (f.ci === "pending") return { kind: "wait" }

  const stubs = f.problems.find((p) => p.startsWith("stubs left"))
  const needsRepair = f.conflicting || f.ci === "failure" || stubs !== undefined
  if (needsRepair && f.rounds >= MAX_ROUNDS) return { kind: "stopped" }

  if (f.conflicting) {
    return { kind: "heal", finding: "The branch conflicts with master. Rebase onto `origin/master`, resolve the conflicts, run VERIFY, push with `--force-with-lease`.", files: [] }
  }
  if (f.ci === "failure") {
    return { kind: "heal", ...(f.failure ?? { finding: "CI `verify` fails; read `gh pr checks` for the first error.", files: [] }) }
  }
  if (stubs) return { kind: "heal", finding: `Stubs are left in your files; implement them:\n${stubs}`, files: [] }

  const unlinked = f.problems.find((p) => p.startsWith("not linked"))
  if (unlinked) return { kind: "owner", why: unlinked }

  const owner = f.reasons.filter((r) => r.startsWith("3.") || r.startsWith("4."))
  if (owner.length) return { kind: "owner", why: owner.join("; ") }
  if (f.reasons.some((r) => r.startsWith("1."))) return { kind: "rebase" }
  return { kind: "merge" }
}

/** The first failing verify step from `gh run view --log-failed`, and up to 3 repo files it names. */
export const firstError = (log: string): { finding: string; files: Array<string> } => {
  // Each row is "<job>\t<step>\t<timestamp> <text>".
  const rows = log.split("\n").map((row) => row.replace(/^[^\t]*\t[^\t]*\t\S+ ?/, "").replace(/^##\[group\]/, ""))
  const start = rows.findIndex((row) => row.startsWith("✗ "))
  const from = start === -1 ? Math.max(0, rows.length - 40) : start
  const end = rows.findIndex((row, i) => i > from && row.startsWith("Fix the FIRST error"))
  const excerpt = rows
    .slice(from, end === -1 ? from + 40 : end)
    .filter((row) => !/^\(pass\) |^##\[endgroup\]|^$/.test(row))
    .join("\n")
    .trim()

  // Tests run inside their workspace and print `src/…`; typecheck and lint print paths from the repo root.
  const workspace = /^✗ test (\w+)/.exec(rows[from] ?? "")?.[1]
  const paths = excerpt.match(/(?<![\w/])(?:(?:be|fe|contract|scripts)\/|src\/|test\/)[\w./-]+\.(?:tsx?|sql)\b/g) ?? []
  const rooted = paths.map((p) => (workspace && /^(src|test)\//.test(p) ? `${workspace}/${p}` : p))
  const files = [...new Set(rooted)].slice(0, 3)
  return { finding: `CI fails:\n${excerpt}`, files }
}

const sh = (cmd: Array<string>) => {
  const p = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" })
  return { ok: p.exitCode === 0, out: `${p.stdout}`.trim(), err: `${p.stderr}`.trim() }
}

interface Pr {
  readonly headRefName: string
  readonly state: string
  readonly mergeable: string
  readonly statusCheckRollup: ReadonlyArray<{ readonly name?: string; readonly conclusion?: string; readonly status?: string; readonly detailsUrl?: string }>
  readonly closingIssuesReferences: ReadonlyArray<{ readonly number: number }>
}

const taskIssue = (pr: Pr) => {
  for (const { number } of pr.closingIssuesReferences) {
    const issue = sh(["gh", "issue", "view", String(number), "--json", "labels,body"])
    if (!issue.ok) continue

    const { labels, body } = JSON.parse(issue.out) as { labels: Array<{ name: string }>; body: string }
    if (!labels.some((l) => l.name === "task")) continue

    const hash = /^VERIFY:.*--hash ([0-9a-f]{8})/m.exec(body)?.[1] ?? ""
    return { number, hash }
  }
  return undefined
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({ options: { feature: { type: "string" } }, allowPositionals: true })
  if (!values.feature || positionals.length === 0) {
    console.error("usage: bun scripts/next.ts --feature <name> <PR number>...")
    process.exit(2)
  }

  const dir = `/tmp/dispatch/${values.feature}`
  const roundsFile = `${dir}/rounds.json`
  const rounds: Record<string, number> = existsSync(roundsFile) ? JSON.parse(readFileSync(roundsFile, "utf8")) : {}

  const plan: Record<Action["kind"], Array<string>> = { wait: [], owner: [], stopped: [], heal: [], rebase: [], merge: [] }
  const heals: Array<Heal> = []

  for (const n of positionals) {
    const view = sh(["gh", "pr", "view", n, "--json", "headRefName,state,mergeable,statusCheckRollup,closingIssuesReferences"])
    if (!view.ok) {
      plan.owner.push(`#${n}: cannot read the PR`)
      continue
    }

    const pr = JSON.parse(view.out) as Pr
    if (pr.state !== "OPEN") continue

    const verify = pr.statusCheckRollup.find((c) => c.name === "verify")
    const ci = verify?.conclusion === "SUCCESS" ? "success" : !verify?.conclusion ? "pending" : "failure"
    const issue = taskIssue(pr)
    const replyFile = issue ? `${dir}/replies/${issue.number}.json` : ""

    const runId = /\/runs\/(\d+)/.exec(verify?.detailsUrl ?? "")?.[1]
    const failure = ci === "failure" && runId ? firstError(sh(["gh", "run", "view", runId, "--log-failed"]).out) : undefined

    const action = route({
      ci,
      conflicting: pr.mergeable === "CONFLICTING",
      problems: recheck(n).filter((p) => !p.startsWith("CI verify")),
      reasons: ci === "success" ? assess(prFacts(n)) : [],
      reply: replyFile && existsSync(replyFile) ? (JSON.parse(readFileSync(replyFile, "utf8")) as Reply) : undefined,
      rounds: rounds[n] ?? 0,
      failure
    })

    if (action.kind === "rebase") {
      const update = sh(["gh", "pr", "update-branch", n, "--rebase"])
      if (!update.ok) {
        plan.owner.push(`#${n}: rebase failed: ${update.err}`)
        continue
      }
    }

    if (action.kind === "heal") {
      if (!issue) {
        plan.owner.push(`#${n}: needs a repair but has no task issue`)
        continue
      }
      heals.push({ issue: issue.number, hash: issue.hash, pr: Number(n), branch: pr.headRefName, finding: action.finding, files: action.files })
    }

    plan[action.kind].push(action.kind === "owner" ? `#${n}: ${action.why}` : `#${n}`)
  }

  for (const [kind, prs] of Object.entries(plan)) {
    if (prs.length) console.log(`${kind}:\n${prs.map((p) => `  ${p}`).join("\n")}`)
  }

  if (heals.length) {
    const file = `${dir}/heals.json`
    writeFileSync(file, JSON.stringify({ feature: values.feature, heals }, null, 2))
    console.log(`\nrepairs ready: bun scripts/dispatch.ts ${file}`)
  }
}
