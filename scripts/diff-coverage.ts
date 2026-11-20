// Did the tests run the code this branch adds? `verify --issue` calls `check` after the test steps, with each
// workspace's lcov report. An uncovered added line means a missing test: behaviour the worker added has its own test.

/** Code a task can add that its tests are expected to run. The React screens have no unit tests, so fe stops at lib. */
const SCOPE = ["be/src/**", "fe/src/lib/**"]
// main.ts only boots the server; the tests serve the same app through app.ts.
const EXCLUDE = ["be/src/main.ts", "**/*.test.ts", "**/*.test.tsx"]
export const MIN_RATIO = 0.9

/** Path → its added line numbers, from `git diff -U0`. */
export const addedLines = (diff: string): Map<string, Array<number>> => {
  const added = new Map<string, Array<number>>()
  let lines: Array<number> | undefined

  for (const row of diff.split("\n")) {
    const file = /^\+\+\+ (?:b\/(.+)|\/dev\/null)$/.exec(row)
    if (file) {
      lines = file[1] ? [] : undefined
      if (file[1] && lines) added.set(file[1], lines)
      continue
    }

    const hunk = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(row)
    if (hunk && lines) {
      const start = Number(hunk[1])
      const count = hunk[2] === undefined ? 1 : Number(hunk[2])
      for (let n = start; n < start + count; n++) lines.push(n)
    }
  }

  return added
}

/** Path (from the repo root) → line → hits, from an lcov report whose paths are relative to `workspace`. */
export const parseLcov = (lcov: string, workspace: string): Map<string, Map<number, number>> => {
  const files = new Map<string, Map<number, number>>()
  let hits: Map<number, number> | undefined

  for (const row of lcov.split("\n")) {
    if (row.startsWith("SF:")) {
      hits = new Map()
      files.set(normalize(`${workspace}/${row.slice(3)}`), hits)
    } else if (row.startsWith("DA:") && hits) {
      const [line, count] = row.slice(3).split(",").map(Number)
      hits.set(line!, count!)
    }
  }

  return files
}

const normalize = (path: string) => {
  const parts: Array<string> = []
  for (const part of path.split("/")) {
    if (part === "..") parts.pop()
    else if (part !== "." && part !== "") parts.push(part)
  }
  return parts.join("/")
}

const matches = (globs: Array<string>, path: string) => globs.some((g) => new Bun.Glob(g).match(path))

export interface Result {
  readonly ok: boolean
  readonly executable: number
  readonly covered: number
  /** `path:line` of each added executable line no test ran. */
  readonly uncovered: Array<string>
  /** Changed files no test loaded at all: reported, not failed. */
  readonly unloaded: Array<string>
}

export const check = (added: Map<string, Array<number>>, coverage: Map<string, Map<number, number>>): Result => {
  let executable = 0
  let covered = 0
  const uncovered: Array<string> = []
  const unloaded: Array<string> = []

  for (const [path, lines] of added) {
    if (!matches(SCOPE, path) || matches(EXCLUDE, path) || lines.length === 0) continue

    const hits = coverage.get(path)
    if (!hits) {
      unloaded.push(path)
      continue
    }

    // Lines missing from the report aren't executable (comments, types, blank lines): they don't count.
    for (const line of lines) {
      const count = hits.get(line)
      if (count === undefined) continue
      executable++
      if (count > 0) covered++
      else uncovered.push(`${path}:${line}`)
    }
  }

  const ratio = executable === 0 ? 1 : covered / executable
  // ponytail: an unloaded file only warns. Re-export barrels, adapters the tests stub (googleOAuth) and production
  // config are legitimately never loaded; a new module no test reaches slips through until the owner's review.
  return { ok: ratio >= MIN_RATIO, executable, covered, uncovered, unloaded }
}

export const report = (r: Result): string => {
  const percent = r.executable === 0 ? 100 : Math.floor((r.covered / r.executable) * 100)
  const rows = [`${r.covered}/${r.executable} added lines run by a test (${percent}%, min ${MIN_RATIO * 100}%)`]

  if (r.unloaded.length) rows.push("warning, no test loads these files (fine for barrels, stubbed adapters, config):", ...r.unloaded.map((p) => `  ${p}`))
  if (!r.ok && r.uncovered.length) rows.push("no test runs these lines:", ...r.uncovered.map((l) => `  ${l}`))
  if (!r.ok) rows.push("Add tests that exercise them; never weaken or skip a test to pass this.")

  return rows.join("\n")
}
