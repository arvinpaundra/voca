import { Schema, SchemaTransformation } from "effect"

/** Crockford base32: no I, L, O, U, so slugs are hard to misread. */
export const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

/**
 * Pure slug generator: one character per random byte.
 * `byte & 31` is unbiased because 256 is a multiple of 32.
 * The caller supplies the bytes (crypto in the backend, a seed in tests).
 */
export const slug = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => ALPHABET[b & 31]).join("")

const slugOf = (length: number) =>
  Schema.String.pipe(
    Schema.decodeTo( // uppercase first, then check: a pasted lowercase slug still works
      Schema.String.check(Schema.isPattern(new RegExp(`^[${ALPHABET}]{${length}}$`))),
      SchemaTransformation.toUpperCase()
    )
  )

/** Slug lengths differ per model, so one kind can never be decoded as another. */
export const SLUG_LENGTH = { learner: 8, deck: 10, word: 12, session: 14 } as const

export const LearnerSlug = slugOf(SLUG_LENGTH.learner).pipe(Schema.brand("LearnerSlug"))
export type LearnerSlug = typeof LearnerSlug.Type
export const DeckSlug = slugOf(SLUG_LENGTH.deck).pipe(Schema.brand("DeckSlug"))
export type DeckSlug = typeof DeckSlug.Type
export const WordSlug = slugOf(SLUG_LENGTH.word).pipe(Schema.brand("WordSlug"))
export type WordSlug = typeof WordSlug.Type
export const SessionSlug = slugOf(SLUG_LENGTH.session).pipe(Schema.brand("SessionSlug"))
export type SessionSlug = typeof SessionSlug.Type
