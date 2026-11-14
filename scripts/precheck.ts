// Before a task is dispatched: its locked tests must be red against its stubs, and every failure must come from the
// task's own stubs (`not implemented: <TASK>`). Anything else (a 401, another task's stub, a wrong expectation) means
// the tests or the task split are wrong, and a worker would burn its budget finding that out.
//
//   bun scripts/precheck.ts LB be/test/decks.test.ts be/test/words.test.ts

export {}

interface Failure {
  readonly name: string
  readonly output: string
}

const [task, ...files] = process.argv.slice(2)

if (!task || files.length === 0) {
  console.error("usage: bun scripts/precheck.ts <TASK> <locked test files of one workspace>")
  process.exit(2)
}

const workspace = files[0]!.split("/")[0]!
const testPaths = files.map((file) => file.slice(workspace.length + 1))

const run = Bun.spawnSync(["bun", "test", ...testPaths], {
  cwd: workspace,
  stdout: "pipe",
  stderr: "pipe",
  env: { ...process.env, NO_COLOR: "1" }
})
const output = `${run.stdout}${run.stderr}`

// Bun prints a failing test's output, then its `(fail) <name>` line.
const failures: Array<Failure> = []
let buffer: Array<string> = []

for (const line of output.split("\n")) {
  if (line.startsWith("(fail) ")) {
    failures.push({ name: line.slice("(fail) ".length), output: buffer.join("\n") })
    buffer = []
    continue
  }

  if (line.startsWith("(pass) ") || /^\S+\.test\.tsx?:$/.test(line)) {
    buffer = []
    continue
  }

  buffer.push(line)
}

const marker = `not implemented: ${task}`
const foreign = failures.filter((failure) => !failure.output.includes(marker))

if (failures.length === 0) {
  console.log(`✗ ${task}: no locked test fails against the stubs, so there is nothing to implement`)
  process.exit(1)
}

if (foreign.length > 0) {
  console.log(`✗ ${task}: ${foreign.length} of ${failures.length} failures are not this task's stubs:\n`)

  for (const failure of foreign) {
    const firstLines = failure.output
      .split("\n")
      .filter((line) => line.trim() !== "" && !/^\s+at /.test(line))
      .slice(0, 6)
      .join("\n")

    console.log(`- ${failure.name}\n${firstLines}\n`)
  }

  process.exit(1)
}

console.log(`✓ ${task}: ${failures.length} locked tests fail, all on its own stubs`)
