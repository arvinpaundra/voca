import { Option, Result, Schema } from "effect"
import { Example, Meaning, Notes, Reading, Term } from "@voca/contract"
import type { CsvRowError } from "./errors.ts"

export const MAX_IMPORT_ROWS = 20_000

/** The columns a word is built from. `hiragana`, `pinyin` and `jyutping` are aliases of `reading`. */
export type WordColumn = "term" | "meaning" | "reading" | "example" | "notes"

/** One data row of an import, text trimmed and checked against the Word Schemas; empty optional text is `null`. */
export interface CsvWordRow {
  readonly term: string
  readonly meaning: string
  readonly reading: string | null
  readonly example: string | null
  readonly notes: string | null
}

const ALIASES = new Map<string, WordColumn>([
  ["term", "term"],
  ["meaning", "meaning"],
  ["reading", "reading"],
  ["hiragana", "reading"],
  ["pinyin", "reading"],
  ["jyutping", "reading"],
  ["example", "example"],
  ["notes", "notes"]
])

const REQUIRED: ReadonlyArray<WordColumn> = ["term", "meaning"]

const LIMITS: Record<WordColumn, number> = {
  term: 200,
  meaning: 500,
  reading: 200,
  example: 1000,
  notes: 2000
}

const decoders = {
  term: Schema.decodeUnknownOption(Term),
  meaning: Schema.decodeUnknownOption(Meaning),
  reading: Schema.decodeUnknownOption(Reading),
  example: Schema.decodeUnknownOption(Example),
  notes: Schema.decodeUnknownOption(Notes)
}

const mapHeader = (header: ReadonlyArray<string>): Result.Result<ReadonlyArray<WordColumn>, ReadonlyArray<CsvRowError>> => {
  const errors: Array<CsvRowError> = []
  const columns: Array<WordColumn> = []
  const seen = new Set<WordColumn>()

  for (const raw of header) {
    const name = raw.trim()
    const column = ALIASES.get(name.toLowerCase())

    if (column === undefined) {
      errors.push({ row: 1, column: name, message: `Unknown column "${name}"` })
      continue
    }

    if (seen.has(column)) {
      errors.push({ row: 1, column: name, message: `Column "${column}" appears more than once` })
    }

    seen.add(column)
    columns.push(column)
  }

  for (const required of REQUIRED) {
    if (!seen.has(required)) {
      errors.push({ row: 1, column: required, message: `Missing required column "${required}"` })
    }
  }

  return errors.length === 0 ? Result.succeed(columns) : Result.fail(errors)
}

const decodeField = (column: WordColumn, raw: string, row: number): Result.Result<string | null, CsvRowError> => {
  const text = raw.trim()

  if (text === "") {
    return REQUIRED.includes(column)
      ? Result.fail({ row, column, message: `${column} is required` })
      : Result.succeed(null)
  }

  return Option.match(decoders[column](text), {
    onNone: () => Result.fail({ row, column, message: `${column} must be 1 to ${LIMITS[column]} characters` }),
    onSome: (value) => Result.succeed(value)
  })
}

const decodeRow = (
  record: ReadonlyArray<string>,
  columns: ReadonlyArray<WordColumn>,
  row: number
): Result.Result<CsvWordRow, ReadonlyArray<CsvRowError>> => {
  if (record.length !== columns.length) {
    return Result.fail([{ row, column: null, message: `Expected ${columns.length} fields, found ${record.length}` }])
  }

  const errors: Array<CsvRowError> = []
  const values: Partial<Record<WordColumn, string | null>> = {}

  for (let index = 0; index < columns.length; index++) {
    const column = columns[index]!
    const field = decodeField(column, record[index] ?? "", row)

    if (Result.isFailure(field)) {
      errors.push(field.failure)
    } else {
      values[column] = field.success
    }
  }

  if (errors.length > 0) {
    return Result.fail(errors)
  }

  return Result.succeed({
    term: values.term ?? "",
    meaning: values.meaning ?? "",
    reading: values.reading ?? null,
    example: values.example ?? null,
    notes: values.notes ?? null
  })
}

/**
 * The words of an import's records, header first, and every problem found. Nothing is imported unless `errors` is
 * empty. A blank line is skipped, but it still counts in the row numbers, as a spreadsheet shows it.
 */
export const readWords = (
  records: ReadonlyArray<ReadonlyArray<string>>
): { readonly rows: ReadonlyArray<CsvWordRow>; readonly errors: ReadonlyArray<CsvRowError> } => {
  const [header] = records

  if (header === undefined) {
    return { rows: [], errors: [{ row: 1, column: null, message: "The file is empty" }] }
  }

  const mapped = mapHeader(header)

  if (Result.isFailure(mapped)) {
    return { rows: [], errors: mapped.failure }
  }

  const body = records.length - 1

  if (body > MAX_IMPORT_ROWS) {
    const message = `A file holds at most ${MAX_IMPORT_ROWS.toLocaleString("en-US")} rows`

    return { rows: [], errors: [{ row: MAX_IMPORT_ROWS + 2, column: null, message }] }
  }

  const rows: Array<CsvWordRow> = []
  const errors: Array<CsvRowError> = []

  for (let index = 1; index < records.length; index++) {
    const record = records[index]!
    const row = index + 1

    if (record.length === 1 && record[0] === "") {
      continue
    }

    const decoded = decodeRow(record, mapped.success, row)

    if (Result.isFailure(decoded)) {
      errors.push(...decoded.failure)
    } else {
      rows.push(decoded.success)
    }
  }

  return { rows, errors }
}
