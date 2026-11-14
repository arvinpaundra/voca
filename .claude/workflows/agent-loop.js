export const meta = {
  name: 'agent-loop',
  description: 'Voca agent loop: one worker per task issue, each in its own worktree; or narrow heal rounds for failing PRs',
  whenToUse: 'After /feature has created the task issues (or to heal failing PRs). Args: { tasks: [...] } or { heals: [...] }.',
  phases: [
    { title: 'Implement', detail: 'one worker per task, own worktree, fail-fast first' },
    { title: 'Heal', detail: 'one narrow fix per failing PR' },
  ],
}

// args.tasks: [{ issue, hash, base, branch, title, model, effort }]
//   base = the dispatch commit holding the task's locked tests and stubs
//   model / effort are always explicit: workers start on haiku; never opus for routine work
// args.heals: [{ issue, hash, pr, branch, worktree, finding, files, model }]
//   one narrow fix round each: the finding and the 2-3 files involved, nothing else

const REPLY = {
  type: 'object',
  properties: {
    pr: { type: ['number', 'null'] },
    worktree: { type: 'string', description: 'output of pwd' },
    green: { type: 'boolean', description: 'did the last VERIFY end with "verify: all green"' },
    disputed: { type: ['string', 'null'], description: 'a locked test or finding you think is wrong, and why' },
    couldNotDo: { type: 'string' },
  },
  required: ['pr', 'worktree', 'green', 'disputed', 'couldNotDo'],
}

const workerPrompt = (t) => `Do GitHub issue #${t.issue} in the repo you are in (arvinpaundra/voca). The issue is the approved design: implement it now.

1. \`bun install --frozen-lockfile\`, then \`git switch -c ${t.branch} ${t.base}\` (the dispatch commit with your locked tests and stubs).
2. Follow AGENTS.md "If you were given a task", fail fast included: run the locked tests before writing code, and if any failure is not \`not implemented: \` from your own stubs, stop and put it in \`disputed\`.
3. Your VERIFY command: \`bun run verify --issue ${t.issue} --hash ${t.hash}\` (a hash of the issue's limits block, not a commit).
4. Open the PR as AGENTS.md says. Do not merge, do not edit the issue.

Return the structured reply.`

const healPrompt = (h) => `Your PR #${h.pr} for GitHub issue #${h.issue} needs one fix. Work in \`${h.worktree}\` on branch ${h.branch}.

Finding:
${h.finding}

Files involved: ${h.files.join(', ')}. Read only what you need. Fix it on the same branch, run \`bun run verify --issue ${h.issue} --hash ${h.hash}\` until it ends with "verify: all green", commit, push. If the finding is wrong, don't work around it: put it in \`disputed\`. Return the structured reply.`

const tasks = (args && args.tasks) || []
const heals = (args && args.heals) || []

phase('Implement')
const implemented = await parallel(tasks.map((t) => () =>
  agent(workerPrompt(t), {
    label: `#${t.issue} ${t.title}`,
    phase: 'Implement',
    model: t.model || 'haiku',
    effort: t.effort || 'medium',
    isolation: 'worktree',
    schema: REPLY,
  }).then((reply) => ({ issue: t.issue, ...reply }))
))

phase('Heal')
const healed = await parallel(heals.map((h) => () =>
  agent(healPrompt(h), {
    label: `heal #${h.pr}`,
    phase: 'Heal',
    model: h.model || 'haiku',
    effort: 'medium',
    schema: REPLY,
  }).then((reply) => ({ issue: h.issue, ...reply }))
))

const failed = tasks.length - implemented.filter(Boolean).length
if (failed > 0) log(`${failed} task agent(s) returned nothing`)

return { implemented: implemented.filter(Boolean), healed: healed.filter(Boolean) }
