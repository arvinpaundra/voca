import type { ColumnMatch, ImportField } from "@voca/contract"

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

export const UNREADABLE = "not implemented: LF"

export const BATCH_UNREADABLE = "not implemented: LF"

export const MATCH_OPTIONS: ReadonlyArray<{ readonly value: Match; readonly label: string }> = [
  { value: null, label: "not implemented: LF" }
]

const notImplemented = (): never => {
  throw new Error("not implemented: LF")
}

export const readHeader = (_bytes: Uint8Array): Header => notImplemented()

export const readFileHeader = (_file: Blob): Promise<Header> => Promise.reject(new Error("not implemented: LF"))

export const columnLabel = (_name: string, _index: number): string => notImplemented()

export const initialMatch = (_names: ReadonlyArray<string>): ReadonlyArray<Match> => notImplemented()

export const chooseField = (_match: ReadonlyArray<Match>, _index: number, _field: Match): ReadonlyArray<Match> =>
  notImplemented()

export const missingLines = (_match: ReadonlyArray<Match>): ReadonlyArray<string> => notImplemented()

export const batchRows = (_files: ReadonlyArray<BatchFile>): ReadonlyArray<BatchRow> => notImplemented()

export const initialBatchMatch = (_rows: ReadonlyArray<BatchRow>): BatchMatch => notImplemented()

export const fileColumns = (_header: ReadonlyArray<string>, _match: BatchMatch): ColumnMatch => notImplemented()

export const batchProblems = (_files: ReadonlyArray<BatchFile>, _match: BatchMatch): ReadonlyArray<string> =>
  notImplemented()
