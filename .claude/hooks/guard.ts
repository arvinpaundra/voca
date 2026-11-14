// PreToolUse hook on Bash: refuses the agents' never-rules (no --no-verify, no force-push, no push to master, no issue
// edits, no writes through `gh api`) before the command runs.
// Exit 2 blocks the call and stderr tells the model why. It stops mistakes, not a determined agent
// (e.g. a command assembled at runtime); CI's path guard and the owner's review stay the backstop.
import { resolve } from "node:path"

const input = (await Bun.stdin.json()) as { tool_input?: { command?: string }; cwd?: string }
const command = input.tool_input?.command ?? ""
const sessionCwd = input.cwd ?? process.cwd()

// The directory a segment runs in: a `cd` earlier in the command, or `git -C <dir>`, moves it away from the session's.
let cwd = sessionCwd
const expand = (dir: string) => resolve(cwd, dir.replace(/^~(?=\/|$)/, process.env.HOME ?? "~"))
const currentBranch = (dir: string) => Bun.spawnSync(["git", "-C", dir, "branch", "--show-current"]).stdout.toString().trim()

// Heredoc bodies and quoted strings are text (a commit message, a file being written), not commands: drop them first.
// Ceiling: this also hides a command wrapped in quotes, e.g. `bash -c "git push -f"`.
const code = command
  .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\n|$)/g, "")
  .replace(/'[^']*'/g, "''")
  .replace(/"(?:\\.|[^"\\])*"/g, '""')

/** Each shell segment on its own, so `a && git push -f` and `git push; echo -f` are judged correctly. */
const segments = code.split(/&&|\|\||[;|\n]/).map((s) => s.trim())

const refuse = (segment: string): string | undefined => {
  if (/(^|\s)--no-verify\b/.test(segment)) return "never --no-verify: fix what the hook found instead"

  const push = /\bgit\s+(?:-C\s+\S+\s+)?push\b(.*)/.exec(segment)
  if (push) {
    const args = push[1]!.trim().split(/\s+/).filter(Boolean)
    if (args.some((a) => a === "--force" || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(a) || a.startsWith("+") || /:\+/.test(a)))
      return "never force-push (the decision thread may use --force-with-lease on a rebased PR branch)"
    const refs = args.filter((a) => !a.startsWith("-"))
    if (refs.some((r) => /(^|:)(refs\/heads\/)?master$/.test(r))) return "never push to master: open a PR"
    const gitDir = /\bgit\s+-C\s+(\S+)/.exec(segment)?.[1]
    if (refs.length <= 1 && currentBranch(gitDir ? expand(gitDir) : cwd) === "master") return "never push to master: you are on master, push a branch and open a PR"
  }

  if (/\bgh\s+issue\s+edit\b/.test(segment)) return "never edit an issue: a task issue is written once by the dispatcher"

  const api = /\bgh\s+api\b(.*)/.exec(segment)
  if (api) {
    const a = api[1]!
    const method = /(?:^|\s)(?:-X|--method)[=\s]?\s*([A-Za-z]+)/.exec(a)?.[1]?.toUpperCase()
    const hasFields = /(?:^|\s)(-f|-F|--field|--raw-field|--input)(?=[\s=]|$)/.test(a)
    if ((method && method !== "GET") || (hasFields && method !== "GET"))
      return "never write through `gh api` (only reads; add -X GET for a query with fields)"
  }
  return undefined
}

for (const segment of segments) {
  const cd = /^cd\s+(\S+)$/.exec(segment)?.[1]
  if (cd) {
    cwd = expand(cd)
    continue
  }
  const reason = refuse(segment)
  if (reason) {
    console.error(`Blocked by .claude/hooks/guard.ts: ${reason}.`)
    process.exit(2)
  }
}
