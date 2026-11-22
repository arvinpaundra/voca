import { DateTime, Option, Schema } from "effect"
import { ImportBatchSlug } from "@voca/contract"
import type { ImportBatch, ImportFile } from "@voca/contract"

/** The longest deck title a file can give, in characters. */
export const DECK_TITLE_MAX = 120

/**
 * The deck a file becomes: its name without the last extension, trimmed and cut to 120 characters. None when nothing
 * is left, so the file names no deck.
 */
export const deckTitleOf = (fileName: string): Option.Option<string> => {
  const dot = fileName.lastIndexOf(".")
  const stem = dot < 0 ? fileName : fileName.slice(0, dot)
  const title = Array.from(stem.trim()).slice(0, DECK_TITLE_MAX).join("").trimEnd()

  return title === "" ? Option.none() : Option.some(title)
}

/** A batch slug the server just generated; the decode checks its shape. */
export const batchSlugOf = (generated: string): ImportBatchSlug => {
  return Schema.decodeSync(ImportBatchSlug)(generated)
}

/** A file as it reads before the worker takes it: no deck, no counts, no errors. */
export const pendingFile = (name: string): ImportFile => {
  return {
    name,
    status: "pending",
    deck: null,
    imported: 0,
    skippedDuplicates: 0,
    errors: [],
    totalErrors: 0
  }
}

/** The batch as the upload answers it: every file pending, in upload order. */
export const pendingBatch = (input: {
  readonly slug: ImportBatchSlug
  readonly termLang: string
  readonly meaningLang: string
  readonly createdAt: number
  readonly names: ReadonlyArray<string>
}): ImportBatch => {
  return {
    slug: input.slug,
    termLang: input.termLang,
    meaningLang: input.meaningLang,
    createdAt: DateTime.makeUnsafe(input.createdAt),
    files: input.names.map(pendingFile)
  }
}
