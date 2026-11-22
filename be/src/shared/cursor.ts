import { Option, Schema } from "effect"

/**
 * A page cursor is the last row's sort values as base64url JSON. It is opaque to the client, not secret: it may only
 * hold values the client can already see. A tie-breaker travels as the row's slug, and the query looks its id up.
 */
export const encodeCursor = (keyset: Readonly<Record<string, string | number>>): string => {
  return Buffer.from(JSON.stringify(keyset)).toString("base64url")
}

/** An absent or undecodable cursor is none: the list starts from its first page. */
export const decodeCursor = <S extends Schema.Top & { readonly DecodingServices: never }>(
  keyset: S,
  cursor: string | null
): Option.Option<S["Type"]> => {
  if (cursor === null) {
    return Option.none()
  }

  const json = Buffer.from(cursor, "base64url").toString("utf8")

  return Schema.decodeUnknownOption(Schema.fromJsonString(keyset))(json)
}
