import { describe, expect, test } from "bun:test"
import { Result } from "effect"
import { parseCsv, toCsv } from "../src/library/domain/csv.ts"

// The CSV parser and writer: RFC 4180, pure, no I/O.

describe("parseCsv", () => {
  test.each([
    ["plain rows", "term,meaning\n食べる,to eat\n", [["term", "meaning"], ["食べる", "to eat"]]],
    ["CRLF line ends", "a,b\r\n1,2\r\n", [["a", "b"], ["1", "2"]]],
    ["no newline at the end", "a,b\n1,2", [["a", "b"], ["1", "2"]]],
    ["a quoted comma", 'a,b\n"life, living",x\n', [["a", "b"], ["life, living", "x"]]],
    ["an escaped quote", 'a\n"say ""hi"""\n', [["a"], ['say "hi"']]],
    ["a line break inside quotes", 'a,b\n"line 1\nline 2",x\n', [["a", "b"], ["line 1\nline 2", "x"]]],
    ["an empty middle field", "a,b,c\n1,,3\n", [["a", "b", "c"], ["1", "", "3"]]],
    ["an empty last field", "a,b\n1,\n", [["a", "b"], ["1", ""]]],
    ["a leading BOM", "﻿a,b\n1,2\n", [["a", "b"], ["1", "2"]]]
  ])("%s", (_, text, records) => {
    expect(parseCsv(text)).toEqual(Result.succeed(records))
  })

  test("an unclosed quote fails on the record where it opens", () => {
    expect(parseCsv('a,b\n1,2\n"open,x\n')).toMatchObject({ _tag: "Failure", failure: { row: 3 } })
  })
})

describe("toCsv", () => {
  test("quotes a field only when it holds a comma, a quote or a line break", () => {
    const text = toCsv([["plain", "a,b", 'say "hi"', "line 1\nline 2"]])

    expect(text).toStartWith('plain,"a,b","say ""hi""","line 1\nline 2"')
  })

  test("parseCsv reads back what toCsv writes", () => {
    const records = [
      ["term", "meaning", "reading", "example", "notes"],
      ["生活", "life, living", "せいかつ", "", ""],
      ["言う", 'to say "so"', "いう", "彼は\nそう言った", "godan"]
    ]

    expect(parseCsv(toCsv(records))).toEqual(Result.succeed(records))
  })
})
