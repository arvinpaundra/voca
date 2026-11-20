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
export const parseCsv = (_text: string): Result.Result<ReadonlyArray<ReadonlyArray<string>>, CsvSyntaxError> =>
  Result.fail({ row: 0, message: "not implemented: CSVB" })

/** CSV text that `parseCsv` reads back as the same records; a field is quoted only when it has to be. */
export const toCsv = (_records: ReadonlyArray<ReadonlyArray<string>>): string => "not implemented: CSVB"
