import { Result } from "effect"

/** Where the text stops being valid CSV: the record it is in, counted from 1 (the header), and why. */
export interface CsvSyntaxError {
  readonly row: number
  readonly message: string
}

/**
 * The RFC 4180 records of a CSV text, header first: a leading BOM is dropped, lines end in CRLF or LF, a quoted
 * field may hold commas, doubled quotes and line breaks.
 */
export const parseCsv = (text: string): Result.Result<ReadonlyArray<ReadonlyArray<string>>, CsvSyntaxError> => {
  const source = text.startsWith("﻿") ? text.slice(1) : text
  const records: Array<Array<string>> = []
  let record: Array<string> = []
  let field = ""
  let inQuotes = false
  let quotedAt = 0
  // A line break ends a record, so only text after the last one needs a record of its own at the end.
  let hasContent = false

  for (let index = 0; index < source.length; index++) {
    const char = source.charAt(index)
    hasContent = true

    if (inQuotes) {
      if (char === '"' && source.charAt(index + 1) === '"') {
        field += '"'
        index++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
    } else if (char === '"' && field === "") {
      inQuotes = true
      quotedAt = records.length + 1
    } else if (char === ",") {
      record.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source.charAt(index + 1) === "\n") {
        index++
      }

      record.push(field)
      records.push(record)
      record = []
      field = ""
      hasContent = false
    } else {
      field += char
    }
  }

  if (inQuotes) {
    return Result.fail({ row: quotedAt, message: "A quoted field is never closed" })
  }

  if (hasContent) {
    record.push(field)
    records.push(record)
  }

  return Result.succeed(records)
}

const quote = (field: string): string => {
  return /[",\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field
}

/** CSV text that `parseCsv` reads back as the same records; a field is quoted only when it has to be. */
export const toCsv = (records: ReadonlyArray<ReadonlyArray<string>>): string => {
  return records.map((record) => record.map(quote).join(",") + "\r\n").join("")
}
