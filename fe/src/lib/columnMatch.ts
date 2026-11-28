import { IMPORT_FIELDS, type ColumnMatch, type ImportField } from "@voca/contract"

export type Match = ImportField | null

export type Header =
  | { readonly kind: "read"; readonly names: ReadonlyArray<string> }
  | { readonly kind: "unreadable" }

export type BatchMatch = Readonly<Record<string, Match>>

export interface BatchFile {
  readonly name: string
  readonly header: ReadonlyArray<string>
}

export interface BatchRow {
  readonly key: string
  readonly label: string
  readonly files: number
}

export const UNREADABLE = "Can't read this file's header. Save it as CSV UTF-8 with a header row, then choose it again."

export const BATCH_UNREADABLE = "Can't read this file's header. Save it as CSV UTF-8 with a header row."

export const MATCH_OPTIONS: ReadonlyArray<{ readonly value: Match; readonly label: string }> = [
  { value: null, label: "Not imported" },
  { value: "term", label: "Term" },
  { value: "meaning", label: "Meaning" },
  { value: "reading", label: "Reading" },
  { value: "example", label: "Example" },
  { value: "notes", label: "Notes" }
]

const HEADER_BYTES = 64 * 1024

const UNREADABLE_HEADER: Header = { kind: "unreadable" }

const REQUIRED_FIELDS: ReadonlyArray<ImportField> = ["term", "meaning"]

const BLANK_LABEL = "(no name)"

const KNOWN_FIELDS: ReadonlyMap<string, ImportField> = new Map<string, ImportField>([
  ["term", "term"],
  ["meaning", "meaning"],
  ["reading", "reading"],
  ["hiragana", "reading"],
  ["pinyin", "reading"],
  ["jyutping", "reading"],
  ["example", "example"],
  ["notes", "notes"]
])

const nameKey = (name: string): string => name.trim().toLowerCase()

const labelOf = (field: ImportField): string => MATCH_OPTIONS.find((option) => option.value === field)?.label ?? field

const knownField = (name: string): Match => KNOWN_FIELDS.get(nameKey(name)) ?? null

const claimFields = (names: ReadonlyArray<string>): ReadonlyArray<Match> => {
  const taken = new Set<ImportField>()

  return names.map((name) => {
    const field = knownField(name)

    if (field === null || taken.has(field)) return null

    taken.add(field)

    return field
  })
}

const decodeUtf8 = (bytes: Uint8Array): string | null => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes, { stream: true })
  } catch {
    return null
  }
}

const firstRecord = (text: string): ReadonlyArray<string> | null => {
  const names: string[] = []
  let name = ""
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index)

    if (quoted) {
      if (char === '"' && text.charAt(index + 1) === '"') {
        name += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        name += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ",") {
      names.push(name)
      name = ""
    } else if (char === "\n" || char === "\r") {
      names.push(name)
      return names
    } else {
      name += char
    }
  }

  if (quoted) return null

  names.push(name)

  return names
}

export const readHeader = (bytes: Uint8Array): Header => {
  const text = decodeUtf8(bytes)

  if (text === null || text.length === 0) return UNREADABLE_HEADER

  const names = firstRecord(text)

  return names === null ? UNREADABLE_HEADER : { kind: "read", names }
}

export const readFileHeader = async (file: Blob): Promise<Header> => {
  const bytes = await file.slice(0, HEADER_BYTES).arrayBuffer()

  return readHeader(new Uint8Array(bytes))
}

export const columnLabel = (name: string, index: number): string => {
  const trimmed = name.trim()

  return trimmed === "" ? `Column ${index + 1} (no name)` : trimmed
}

export const initialMatch = (names: ReadonlyArray<string>): ReadonlyArray<Match> => claimFields(names)

export const chooseField = (match: ReadonlyArray<Match>, index: number, field: Match): ReadonlyArray<Match> =>
  match.map((current, position) => {
    if (position === index) return field

    if (field !== null && current === field) return null

    return current
  })

export const missingLines = (match: ReadonlyArray<Match>): ReadonlyArray<string> =>
  REQUIRED_FIELDS.filter((field) => !match.includes(field)).map((field) => `Choose a column for ${labelOf(field)}.`)

export const fileCount = (count: number): string => `${count} ${count === 1 ? "file" : "files"}`

export const batchRows = (files: ReadonlyArray<BatchFile>): ReadonlyArray<BatchRow> => {
  const rows = new Map<string, { label: string; files: number }>()

  for (const file of files) {
    const seen = new Set<string>()

    for (const name of file.header) {
      const key = nameKey(name)

      if (seen.has(key)) continue

      seen.add(key)

      const row = rows.get(key)

      if (row === undefined) {
        rows.set(key, { label: key === "" ? BLANK_LABEL : name.trim(), files: 1 })
      } else {
        row.files += 1
      }
    }
  }

  return [...rows.entries()]
    .map(([key, row]) => ({ key, label: row.label, files: row.files }))
    .sort((first, second) => second.files - first.files)
}

export const initialBatchMatch = (rows: ReadonlyArray<BatchRow>): BatchMatch => {
  const fields = claimFields(rows.map((row) => row.key))

  return Object.fromEntries(rows.map((row, index) => [row.key, fields[index] ?? null]))
}

export const matchOf = (match: BatchMatch, key: string): Match =>
  Object.hasOwn(match, key) ? (match[key] ?? null) : null

export const fileColumns = (header: ReadonlyArray<string>, match: BatchMatch): ColumnMatch =>
  header.map((name) => matchOf(match, nameKey(name)))

interface CountedFile {
  readonly name: string
  readonly columns: ColumnMatch
}

const countOf = (columns: ColumnMatch, field: ImportField): number =>
  columns.filter((column) => column === field).length

const listNames = (files: ReadonlyArray<CountedFile>): string => {
  const shown = files
    .slice(0, 3)
    .map((file) => file.name)
    .join(", ")
  const more = files.length - 3

  return more > 0 ? `${shown} and ${more} more` : shown
}

const duplicateLines = (files: ReadonlyArray<CountedFile>): ReadonlyArray<string> =>
  IMPORT_FIELDS.flatMap((field) => {
    const counts = [...new Set(files.map((file) => countOf(file.columns, field)))]
      .filter((count) => count > 1)
      .sort((first, second) => first - second)

    return counts.map((count) => {
      const hit = files.filter((file) => countOf(file.columns, field) === count)

      return `${labelOf(field)} is chosen for ${count} columns in ${fileCount(hit.length)}: ${listNames(hit)}. Pick one.`
    })
  })

const absentLines = (files: ReadonlyArray<CountedFile>): ReadonlyArray<string> =>
  REQUIRED_FIELDS.flatMap((field) => {
    const hit = files.filter((file) => countOf(file.columns, field) === 0)

    if (hit.length === 0) return []

    const verb = hit.length === 1 ? "file has" : "files have"

    return [`${hit.length} ${verb} no column for ${labelOf(field)}: ${listNames(hit)}.`]
  })

export const batchProblems = (files: ReadonlyArray<BatchFile>, match: BatchMatch): ReadonlyArray<string> => {
  const counted = files.map((file) => ({ name: file.name, columns: fileColumns(file.header, match) }))

  return [...duplicateLines(counted), ...absentLines(counted)]
}
