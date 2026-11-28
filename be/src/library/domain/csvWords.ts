import { Option, Result, Schema } from "effect"
import { Example, ImportField, Meaning, Notes, Reading, Term } from "@voca/contract"
import type { ColumnMatch } from "@voca/contract"
import type { CsvRowError } from "./errors.ts"

export const MAX_IMPORT_ROWS = 20_000

export interface CsvWordRow {
  readonly term: string
  readonly meaning: string
  readonly reading: string | null
  readonly example: string | null
  readonly notes: string | null
}

interface MatchedColumn {
  readonly field: ImportField
  readonly label: string
}

const ALIASES = new Map<string, ImportField>([
  ["term", "term"],
  ["meaning", "meaning"],
  ["reading", "reading"],
  ["hiragana", "reading"],
  ["pinyin", "reading"],
  ["jyutping", "reading"],
  ["example", "example"],
  ["notes", "notes"]
])

const REQUIRED: ReadonlyArray<ImportField> = ["term", "meaning"]

const LABELS: Record<ImportField, string> = {
  term: "Term",
  meaning: "Meaning",
  reading: "Reading",
  example: "Example",
  notes: "Notes"
}

const LIMITS: Record<ImportField, number> = {
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

const columnName = (raw: string, index: number): string => {
  const name = raw.trim()

  return name === "" ? `column ${index + 1}` : name
}

const knownFields = (header: ReadonlyArray<string>): ColumnMatch => {
  const taken = new Set<ImportField>()

  return header.map((raw) => {
    const field = ALIASES.get(raw.trim().toLowerCase())

    if (field === undefined || taken.has(field)) {
      return null
    }

    taken.add(field)

    return field
  })
}

const missingRequired = (fields: ColumnMatch): ReadonlyArray<CsvRowError> => {
  return REQUIRED.filter((field) => !fields.includes(field)).map((field) => ({
    row: 1,
    column: null,
    message: `No column is matched to ${LABELS[field]}`
  }))
}

const matchHeader = (
  header: ReadonlyArray<string>,
  columns: ColumnMatch | undefined
): Result.Result<ReadonlyArray<MatchedColumn | null>, ReadonlyArray<CsvRowError>> => {
  if (columns !== undefined && columns.length !== header.length) {
    return Result.fail([
      {
        row: 1,
        column: null,
        message: `The file has ${header.length} columns, but ${columns.length} were matched`
      }
    ])
  }

  const fields = columns ?? knownFields(header)
  const errors = missingRequired(fields)

  if (errors.length > 0) {
    return Result.fail(errors)
  }

  return Result.succeed(
    fields.map((field, index) =>
      field === null
        ? null
        : { field, label: `${LABELS[field]} (${columnName(header[index] ?? "", index)})` }
    )
  )
}

const decodeField = (column: MatchedColumn, raw: string, row: number): Result.Result<string | null, CsvRowError> => {
  const text = raw.trim()

  if (text === "") {
    return REQUIRED.includes(column.field)
      ? Result.fail({ row, column: column.label, message: "is required" })
      : Result.succeed(null)
  }

  return Option.match(decoders[column.field](text), {
    onNone: () => Result.fail({ row, column: column.label, message: `is longer than ${LIMITS[column.field]} characters` }),
    onSome: (value) => Result.succeed(value)
  })
}

const decodeRow = (
  record: ReadonlyArray<string>,
  matched: ReadonlyArray<MatchedColumn | null>,
  row: number
): Result.Result<CsvWordRow, ReadonlyArray<CsvRowError>> => {
  if (record.length !== matched.length) {
    return Result.fail([{ row, column: null, message: `Expected ${matched.length} fields, found ${record.length}` }])
  }

  const errors: Array<CsvRowError> = []
  const values: Partial<Record<ImportField, string | null>> = {}

  for (let index = 0; index < matched.length; index++) {
    const column = matched[index]!

    if (column === null) {
      continue
    }

    const field = decodeField(column, record[index] ?? "", row)

    if (Result.isFailure(field)) {
      errors.push(field.failure)
    } else {
      values[column.field] = field.success
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

export const readWords = (
  records: ReadonlyArray<ReadonlyArray<string>>,
  columns?: ColumnMatch
): { readonly rows: ReadonlyArray<CsvWordRow>; readonly errors: ReadonlyArray<CsvRowError> } => {
  const [header] = records

  if (header === undefined) {
    return { rows: [], errors: [{ row: 1, column: null, message: "The file is empty" }] }
  }

  const matched = matchHeader(header, columns)

  if (Result.isFailure(matched)) {
    return { rows: [], errors: matched.failure }
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

    const decoded = decodeRow(record, matched.success, row)

    if (Result.isFailure(decoded)) {
      errors.push(...decoded.failure)
    } else {
      rows.push(decoded.success)
    }
  }

  return { rows, errors }
}
