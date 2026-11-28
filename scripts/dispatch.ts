import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"

export interface Task {
  readonly issue: number
  readonly hash: string
  readonly base: string
  readonly branch: string
  readonly title: string
}

export interface Heal {
  readonly issue: number
  readonly hash: string
  readonly pr: number
  readonly branch: string
  readonly finding: string
  readonly files: ReadonlyArray<string>
}

export interface Reply {
  readonly pr: number | null
  readonly worktree: string
  readonly green: boolean
  readonly disputed: string | null
  readonly couldNotDo: string
}

const TIER: Record<number, string> = { 1: "haiku", 2: "haiku", 3: "sonnet", 4: "opus" }
export const tier = (round: number): string | undefined => TIER[round]

const LIMITS = {
  implementer: { maxTurns: 150, minutes: 60 },
  repairer: { maxTurns: 40, minutes: 20 }
}

const REPLY_SCHEMA = {
  type: "object",
  properties: {
    pr: { type: ["number", "null"] },
    worktree: { type: "string" },
    green: { type: "boolean" },
    disputed: { type: ["string", "null"] },
    couldNotDo: { type: "string" }
  },
  required: ["pr", "worktree", "green", "disputed", "couldNotDo"]
}

export const parseReply = (stdout: string, worktree: string, timedOut: boolean, minutes: number): Reply => {
  const failed = (why: string): Reply => ({ pr: null, worktree, green: false, disputed: null, couldNotDo: why })
  if (timedOut) return failed(`timed out after ${minutes} min`)

  let out: { subtype?: string; result?: unknown; structured_output?: Reply }
  try {
    out = JSON.parse(stdout)
  } catch {
    return failed(`unreadable session output: ${stdout.slice(0, 200)}`)
  }

  if (out.structured_output) return out.structured_output
  if (out.subtype === "error_max_turns") return failed("stopped at the max-turns limit")
  return failed(`no structured reply (${out.subtype ?? "unknown"}): ${String(out.result ?? "").slice(0, 200)}`)
}

const git = (...args: Array<string>) => {
  const p = Bun.spawnSync(["git", ...args], { stdout: "pipe", stderr: "pipe" })
  if (p.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${p.stderr}`)
  return `${p.stdout}`.trim()
}

const root = () => git("rev-parse", "--show-toplevel")

const worktreeFor = (branch: string, base?: string): string => {
  const listed = git("worktree", "list", "--porcelain").split("\n\n")
  const existing = listed.find((entry) => entry.includes(`\nbranch refs/heads/${branch}`))
  if (existing) return existing.split("\n")[0]!.replace(/^worktree /, "")

  const path = `${root()}/.claude/worktrees/${branch.replace(/\//g, "-")}`
  if (base) {
    git("worktree", "add", "-b", branch, path, base)
  } else {
    git("fetch", "-q", "origin", branch)
    git("worktree", "add", "-B", branch, path, `origin/${branch}`)
  }

  const install = Bun.spawnSync(["bun", "install", "--frozen-lockfile"], { cwd: path, stdout: "pipe", stderr: "pipe" })
  if (install.exitCode !== 0) throw new Error(`bun install in ${path}: ${install.stderr}`)
  return path
}

const run = async (role: keyof typeof LIMITS, prompt: string, cwd: string, log: string, model?: string): Promise<Reply> => {
  const { maxTurns, minutes } = LIMITS[role]
  const cmd = [
    "claude", "-p", prompt,
    "--agent", role,
    ...(model ? ["--model", model] : []),
    "--setting-sources", "project",
    "--strict-mcp-config",
    "--tools", "Bash,Read,Edit,Write",
    "--disable-slash-commands",
    "--permission-mode", "acceptEdits",
    "--max-turns", String(maxTurns),
    "--output-format", "json",
    "--json-schema", JSON.stringify(REPLY_SCHEMA)
  ]

  const proc = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe", timeout: minutes * 60_000 })
  const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])
  await proc.exited

  writeFileSync(log, `${stdout}\n${stderr}`)
  return parseReply(stdout, cwd, proc.signalCode !== null, minutes)
}

const taskPrompt = (t: Task) => `Task: GitHub issue #${t.issue} in arvinpaundra/voca: ${t.title}.
Branch: ${t.branch}, already checked out at the dispatch commit.
VERIFY: bun run verify --issue ${t.issue} --hash ${t.hash}`

const healPrompt = (h: Heal) => `PR #${h.pr} for GitHub issue #${h.issue} needs one fix. Branch: ${h.branch}.

Finding:
${h.finding}

Files involved: ${h.files.join(", ")}
VERIFY: bun run verify --issue ${h.issue} --hash ${h.hash}`

if (import.meta.main) {
  const file = process.argv[2]
  if (!file) {
    console.error("usage: bun scripts/dispatch.ts <tasks.json>")
    process.exit(2)
  }

  const input = JSON.parse(readFileSync(file, "utf8")) as { feature: string; tasks?: Array<Task>; heals?: Array<Heal> }
  const dir = `/tmp/dispatch/${input.feature}`
  mkdirSync(`${dir}/replies`, { recursive: true })
  mkdirSync(`${dir}/logs`, { recursive: true })

  const roundsFile = `${dir}/rounds.json`
  const rounds: Record<string, number> = existsSync(roundsFile) ? JSON.parse(readFileSync(roundsFile, "utf8")) : {}

  const jobs: Array<() => Promise<string>> = []

  for (const t of input.tasks ?? []) {
    const cwd = worktreeFor(t.branch, t.base)
    jobs.push(async () => {
      const reply = await run("implementer", taskPrompt(t), cwd, `${dir}/logs/${t.issue}-implement.json`)
      writeFileSync(`${dir}/replies/${t.issue}.json`, JSON.stringify(reply, null, 2))
      return `#${t.issue} implement: ${summary(reply)}`
    })
  }

  for (const h of input.heals ?? []) {
    const round = (rounds[h.pr] ?? 0) + 1
    const model = tier(round)
    if (!model) {
      jobs.push(async () => `#${h.issue} PR #${h.pr} stopped: 4 repair rounds failed, the owner decides`)
      continue
    }

    rounds[h.pr] = round
    const cwd = worktreeFor(h.branch)
    jobs.push(async () => {
      const reply = await run("repairer", healPrompt(h), cwd, `${dir}/logs/${h.issue}-repair-${round}.json`, model)
      writeFileSync(`${dir}/replies/${h.issue}.json`, JSON.stringify(reply, null, 2))
      return `#${h.issue} PR #${h.pr} repair round ${round} (${model}): ${summary(reply)}`
    })
  }

  writeFileSync(roundsFile, JSON.stringify(rounds, null, 2))
  for (const line of await Promise.all(jobs.map((job) => job()))) console.log(line)
}

function summary(r: Reply): string {
  const flags = [r.disputed && `disputed: ${r.disputed}`, r.couldNotDo && `couldNotDo: ${r.couldNotDo}`].filter(Boolean)
  return `pr=${r.pr ?? "none"} green=${r.green}${flags.length ? ` ${flags.join("; ")}` : ""}`
}
