import { DateTime, Option, Schema, SchemaTransformation } from "effect"

// ───── Enumerations ─────

export const Drill = Schema.Literals(["term_meaning", "meaning_term", "term_reading", "reading_term"])
export type Drill = typeof Drill.Type

export const Mode = Schema.Literals(["easy", "hard"])
export type Mode = typeof Mode.Type

export const SessionSize = Schema.Literals([7, 10, 15, 20])
export type SessionSize = typeof SessionSize.Type

export const Visibility = Schema.Literals(["private", "public"])
export type Visibility = typeof Visibility.Type

export const Maturity = Schema.Literals(["new", "learning", "mature"])
export type Maturity = typeof Maturity.Type

/** FSRS rating: Again, Hard, Good, Easy. */
export const Rating = Schema.Literals([1, 2, 3, 4])
export type Rating = typeof Rating.Type

// ───── Numbers ─────

const intBetween = (minimum: number, maximum: number) =>
  Schema.Int.check(Schema.isBetween({ minimum, maximum }))

export const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
export const DayStartHour = intBetween(0, 23)
export const NewPerDay = intBetween(0, 200)
export const DesiredRetention = Schema.Finite.check(Schema.isBetween({ minimum: 0.8, maximum: 0.95 }))
/** A probability or share, 0..1. */
export const Ratio = Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 }))
export const NonNegative = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0))

// ───── Text ─────

/** Trimmed on decode, then length-checked in code points (like Postgres `length()`), so 𠮷 counts as 1, not 2. */
const text = (min: number, max: number) =>
  Schema.String.pipe(Schema.decodeTo(Schema.String.check(Schema.isBetweenCodePoints(min, max)), SchemaTransformation.trim()))

export const DeckTitle = text(1, 120)
export const DeckDescription = text(0, 2000)
export const Term = text(1, 200)
export const Reading = text(1, 200)
export const Meaning = text(1, 500)
export const Example = text(1, 1000)
export const Notes = text(1, 2000)
export const SearchQuery = text(1, 100)

/** BCP-47 tag such as `ja`, `zh-Hans`, `en-US`. Shape check only. */
export const LangTag = Schema.String.check(Schema.isPattern(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/))
export type LangTag = typeof LangTag.Type

/** IANA zone, validated by Effect's own zone database. */
export const Timezone = Schema.String.check(
  Schema.makeFilter((zone: string) => Option.isSome(DateTime.zoneMakeNamed(zone)) || "unknown IANA timezone")
)
export type Timezone = typeof Timezone.Type

// ───── Time ─────

/** An instant on the wire: ISO-8601 string, decoded to `DateTime.Utc`. */
export const Instant = Schema.DateTimeUtcFromString

/** A study day, `YYYY-MM-DD`, already resolved in the Learner's timezone and dayStartHour. */
export const StudyDate = Schema.String.check(Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/))

/** A calendar month, `YYYY-MM`. */
export const Month = Schema.String.check(Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/))

// ───── Pagination ─────

export const Cursor = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200))
export const PageLimit = intBetween(1, 200)

/** Keyset pagination query: `?cursor&limit` (default 50, applied by the server). */
export const PageQuery = {
  cursor: Schema.optionalKey(Cursor),
  limit: Schema.optionalKey(PageLimit)
}

export const Page = <S extends Schema.Top>(item: S) =>
  Schema.Struct({ items: Schema.Array(item), nextCursor: Schema.NullOr(Cursor) })
