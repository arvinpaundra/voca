import { Clock, Effect, Option } from "effect"
import { CurrentLearner, SLUG_LENGTH } from "@voca/contract"
import type { CreateWord, UpdateWord, Word } from "@voca/contract"
import { DeckNotFound, DuplicateWordError, WordNotFound } from "../domain/errors.ts"
import { newSlug } from "../domain/slug.ts"
import { normalizeKey, toStoredText } from "../domain/text.ts"
import { Transaction } from "../../shared/transaction.ts"
import type { NewWord, OwnedWord, WordChanges, WordPage } from "./wordRepo.ts"
import { WordRepo } from "./wordRepo.ts"

type Needs = CurrentLearner | WordRepo | Transaction

const DEFAULT_PAGE_SIZE = 50

const findOwnedDeckId = (learnerId: bigint, deckSlug: string) =>
  Effect.gen(function* () {
    const words = yield* WordRepo
    const found = yield* words.findOwnedDeckId(learnerId, deckSlug)

    return yield* Option.match(found, {
      onNone: () => Effect.fail(new DeckNotFound()),
      onSome: Effect.succeed
    })
  })

const findOwnedWord = (learnerId: bigint, wordSlug: string): Effect.Effect<OwnedWord, WordNotFound, WordRepo> =>
  Effect.gen(function* () {
    const words = yield* WordRepo
    const found = yield* words.findOwned(learnerId, wordSlug)

    return yield* Option.match(found, {
      onNone: () => Effect.fail(new WordNotFound()),
      onSome: Effect.succeed
    })
  })

/** Optional text as stored: `undefined` and `null` both mean no text. */
const storedOrNull = (text: string | null | undefined): string | null => {
  return text === undefined || text === null ? null : toStoredText(text)
}

/** The key of an optional reading: the empty string when there is none, so words without a reading still collide. */
const readingKeyOf = (reading: string | null): string => {
  return reading === null ? "" : normalizeKey(reading)
}

const newWordOf = (slug: string, input: typeof CreateWord.Type, createdAt: number): NewWord => {
  const reading = storedOrNull(input.reading)

  return {
    slug,
    term: toStoredText(input.term),
    termKey: normalizeKey(input.term),
    reading,
    readingKey: readingKeyOf(reading),
    meaning: toStoredText(input.meaning),
    meaningKey: normalizeKey(input.meaning),
    example: storedOrNull(input.example),
    notes: storedOrNull(input.notes),
    createdAt
  }
}

/** Only the fields the patch sends; keys are recomputed whenever their text changes. */
const changesOf = (patch: typeof UpdateWord.Type): WordChanges => {
  const changes: WordChanges = {}

  if (patch.term !== undefined) {
    changes.term = toStoredText(patch.term)
    changes.termKey = normalizeKey(patch.term)
  }

  if (patch.meaning !== undefined) {
    changes.meaning = toStoredText(patch.meaning)
    changes.meaningKey = normalizeKey(patch.meaning)
  }

  if (patch.reading !== undefined) {
    const reading = storedOrNull(patch.reading)

    changes.reading = reading
    changes.readingKey = readingKeyOf(reading)
  }

  if (patch.example !== undefined) {
    changes.example = storedOrNull(patch.example)
  }

  if (patch.notes !== undefined) {
    changes.notes = storedOrNull(patch.notes)
  }

  return changes
}

export const listWords = (
  deckSlug: string,
  query: { readonly q?: string; readonly cursor?: string; readonly limit?: number }
): Effect.Effect<WordPage, DeckNotFound, Needs> =>
  Effect.gen(function* () {
    const { id } = yield* CurrentLearner
    const words = yield* WordRepo
    const deckId = yield* findOwnedDeckId(id, deckSlug)

    return yield* words.list(id, deckId, {
      q: query.q === undefined ? null : normalizeKey(query.q),
      cursor: query.cursor ?? null,
      limit: query.limit ?? DEFAULT_PAGE_SIZE
    })
  })

export const createWord = (
  deckSlug: string,
  input: typeof CreateWord.Type
): Effect.Effect<Word, DeckNotFound | DuplicateWordError, Needs> =>
  Effect.gen(function* () {
    const { id } = yield* CurrentLearner
    const words = yield* WordRepo
    const deckId = yield* findOwnedDeckId(id, deckSlug)
    const slug = yield* newSlug(SLUG_LENGTH.word)
    const createdAt = yield* Clock.currentTimeMillis
    const inserted = yield* words.insert(deckId, newWordOf(slug, input, createdAt))

    return yield* Option.match(inserted, {
      onNone: () => Effect.fail(new DuplicateWordError()),
      onSome: Effect.succeed
    })
  })

export const updateWord = (
  wordSlug: string,
  patch: typeof UpdateWord.Type
): Effect.Effect<Word, WordNotFound | DuplicateWordError, Needs> =>
  Effect.gen(function* () {
    const { id } = yield* CurrentLearner
    const words = yield* WordRepo
    const owned = yield* findOwnedWord(id, wordSlug)
    const changes = changesOf(patch)

    if (Object.keys(changes).length === 0) {
      return owned.word
    }

    const updated = yield* words.update(owned.id, changes)

    return yield* Option.match(updated, {
      onNone: () => Effect.fail(new DuplicateWordError()),
      onSome: Effect.succeed
    })
  })

export const deleteWord = (wordSlug: string): Effect.Effect<void, WordNotFound, Needs> =>
  Effect.gen(function* () {
    const { id } = yield* CurrentLearner
    const words = yield* WordRepo
    const transaction = yield* Transaction
    const owned = yield* findOwnedWord(id, wordSlug)
    const at = yield* Clock.currentTimeMillis

    yield* transaction.run(words.softDelete(owned.id, at))
  })
