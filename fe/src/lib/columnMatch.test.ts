import { describe, expect, test } from "bun:test"
import {
  BATCH_UNREADABLE,
  MATCH_OPTIONS,
  UNREADABLE,
  batchProblems,
  batchRows,
  chooseField,
  columnLabel,
  fileColumns,
  initialBatchMatch,
  initialMatch,
  missingLines,
  readFileHeader,
  readHeader,
  type Match
} from "./columnMatch"

const bytes = (text: string) => new TextEncoder().encode(text)

describe("readHeader", () => {
  test("reads the first record's names in file order", () => {
    expect(readHeader(bytes("kosakata,arti,cara baca\n水,air,みず\n"))).toEqual({
      kind: "read",
      names: ["kosakata", "arti", "cara baca"]
    })
  })

  test("drops a leading BOM and reads quoted names with commas, quotes and line breaks", () => {
    expect(readHeader(bytes('﻿"arti, makna","say ""hi""","catatan\nlain",\r\n水,air,,\r\n'))).toEqual({
      kind: "read",
      names: ["arti, makna", 'say "hi"', "catatan\nlain", ""]
    })
  })

  test("a file with only a header line and no line break is read", () => {
    expect(readHeader(bytes("term,meaning"))).toEqual({ kind: "read", names: ["term", "meaning"] })
  })

  test.each([
    ["not UTF-8", new Uint8Array([0x6b, 0x6f, 0xff, 0xfe, 0x2c, 0x61])],
    ["empty", new Uint8Array([])],
    ["only a BOM", bytes("﻿")],
    ["a header that is never closed", bytes('"kosakata,arti\n')]
  ])("a file that is %s can't be read", (_, content) => {
    expect(readHeader(content)).toEqual({ kind: "unreadable" })
  })

  test("a multi-byte character cut at the end of the bytes read is not an encoding error", () => {
    const content = bytes("kosakata,arti\n食べる,makan\n")

    expect(readHeader(content.slice(0, content.length - 9))).toEqual({ kind: "read", names: ["kosakata", "arti"] })
  })

  test("a file is read from its first bytes only", async () => {
    const big = new File([`kosakata,arti\n${"水,air\n".repeat(400_000)}`], "big.csv", { type: "text/csv" })

    expect(await readFileHeader(big)).toEqual({ kind: "read", names: ["kosakata", "arti"] })
  })

  test("the unreadable messages", () => {
    expect(UNREADABLE).toBe("Can't read this file's header. Save it as CSV UTF-8 with a header row, then choose it again.")
    expect(BATCH_UNREADABLE).toBe("Can't read this file's header. Save it as CSV UTF-8 with a header row.")
  })
})

describe("Import CSV matching", () => {
  test("the dropdown offers Not imported, then the fields in order", () => {
    expect(MATCH_OPTIONS).toEqual([
      { value: null, label: "Not imported" },
      { value: "term", label: "Term" },
      { value: "meaning", label: "Meaning" },
      { value: "reading", label: "Reading" },
      { value: "example", label: "Example" },
      { value: "notes", label: "Notes" }
    ])
  })

  test("a column is listed by its trimmed name, or by its position when blank", () => {
    expect(columnLabel(" arti ", 1)).toBe("arti")
    expect(columnLabel("", 3)).toBe("Column 4 (no name)")
    expect(columnLabel("   ", 0)).toBe("Column 1 (no name)")
  })

  test("unknown names start on Not imported, and both required fields are asked for", () => {
    const match = initialMatch(["kosakata", "arti", "cara baca"])

    expect(match).toEqual([null, null, null])
    expect(missingLines(match)).toEqual(["Choose a column for Term.", "Choose a column for Meaning."])
  })

  test("known names start matched, ignoring case and surrounding spaces", () => {
    const match = initialMatch(["Term", " MEANING ", "pinyin", ""])

    expect(match).toEqual(["term", "meaning", "reading", null])
    expect(missingLines(match)).toEqual([])
  })

  test.each<[ReadonlyArray<string>, ReadonlyArray<Match>]>([
    [["hiragana", "jyutping", "reading"], ["reading", null, null]],
    [["notes", "example", "NOTES"], ["notes", "example", null]]
  ])("when two names want one field, the first column gets it: %o", (names, expected) => {
    expect(initialMatch(names)).toEqual(expected)
  })

  test("choosing Term and Meaning leaves only the other columns on Not imported", () => {
    const match = chooseField(chooseField(initialMatch(["kosakata", "arti", "cara baca"]), 0, "term"), 1, "meaning")

    expect(match).toEqual(["term", "meaning", null])
    expect(missingLines(match)).toEqual([])
  })

  test("choosing a field another column has moves it there; that column goes back to Not imported", () => {
    const match = chooseField([null, "meaning", null], 2, "meaning")

    expect(match).toEqual([null, null, "meaning"])
    expect(missingLines(match)).toEqual(["Choose a column for Term."])
  })

  test("a column can go back to Not imported", () => {
    expect(chooseField(["term", "meaning"], 1, null)).toEqual(["term", null])
  })

  test("a blank column can be matched like any other", () => {
    expect(chooseField(initialMatch(["kosakata", "", "arti"]), 1, "reading")).toEqual([null, "reading", null])
  })
})

const file = (name: string, header: ReadonlyArray<string>) => ({ name, header })

const bab = (from: number, count: number, header: ReadonlyArray<string>) =>
  Array.from({ length: count }, (_, i) => file(`Bab ${from + i}.csv`, header))

describe("Import decks rows", () => {
  test("the same names in two orders give one row per name, each in every file", () => {
    const files = [...bab(1, 25, ["kosakata", "arti", "cara baca"]), ...bab(26, 25, ["cara baca", "kosakata", "arti"])]

    expect(batchRows(files)).toEqual([
      { key: "kosakata", label: "kosakata", files: 50 },
      { key: "arti", label: "arti", files: 50 },
      { key: "cara baca", label: "cara baca", files: 50 }
    ])
  })

  test("names are grouped ignoring case and surrounding spaces, most common first, in first-seen order on a tie", () => {
    const files = [
      ...bab(1, 30, ["Kosakata", "arti"]),
      ...bab(31, 20, ["word", " translation ", "notes"]),
      file("Bab 51.csv", ["KOSAKATA ", "ARTI", "cara baca"])
    ]

    expect(batchRows(files)).toEqual([
      { key: "kosakata", label: "Kosakata", files: 31 },
      { key: "arti", label: "arti", files: 31 },
      { key: "word", label: "word", files: 20 },
      { key: "translation", label: "translation", files: 20 },
      { key: "notes", label: "notes", files: 20 },
      { key: "cara baca", label: "cara baca", files: 1 }
    ])
  })

  test("blank header cells share one (no name) row, counted once per file", () => {
    const files = [file("a.csv", ["term", "", "meaning", " "]), file("b.csv", ["term", "meaning", ""])]

    expect(batchRows(files)).toContainEqual({ key: "", label: "(no name)", files: 2 })
  })

  test("only known names start matched", () => {
    const rows = batchRows([...bab(1, 30, ["kosakata", "arti"]), ...bab(31, 20, ["word", "translation", "notes"])])

    expect(initialBatchMatch(rows)).toEqual({
      kosakata: null,
      arti: null,
      word: null,
      translation: null,
      notes: "notes"
    })
  })

  test("when two known names want one field, the first row gets it", () => {
    const rows = batchRows([file("a.csv", ["term", "meaning", "hiragana"]), file("b.csv", ["term", "meaning", "reading"])])

    expect(initialBatchMatch(rows)).toEqual({ term: "term", meaning: "meaning", hiragana: "reading", reading: null })
  })

  test("each file gets its own list for the upload, in its own column order", () => {
    const match = { kosakata: "term", arti: "meaning", "cara baca": "reading", "": null } as const

    expect(fileColumns(["cara baca", " Kosakata", "arti", ""], match)).toEqual(["reading", "term", "meaning", null])
    expect(fileColumns(["arti", "kosakata"], match)).toEqual(["meaning", "term"])
  })
})

describe("Import decks problems", () => {
  test("different names may share a field, as long as no file has both", () => {
    const files = [...bab(1, 30, ["kosakata", "arti"]), ...bab(31, 20, ["word", "translation", "notes"])]
    const match = { kosakata: "term", arti: "meaning", word: "term", translation: "meaning", notes: "notes" } as const

    expect(batchProblems(files, match)).toEqual([])
  })

  test("a file with two columns on one field is named", () => {
    const files = [
      ...bab(1, 3, ["kosakata", "arti"]),
      ...bab(4, 3, ["kosakata", "terjemahan"]),
      file("Bab 7.csv", ["kosakata", "arti", "terjemahan"])
    ]
    const match = { kosakata: "term", arti: "meaning", terjemahan: "meaning" } as const

    expect(batchProblems(files, match)).toEqual(["Meaning is chosen for 2 columns in 1 file: Bab 7.csv. Pick one."])
  })

  test("files with no column for a required field are named, after the two-column lines", () => {
    const files = [...bab(1, 3, ["kosakata", "arti"]), ...bab(4, 3, ["kosakata", "terjemahan"]), file("Bab 7.csv", ["kosakata", "arti", "terjemahan"])]
    const match = { kosakata: "meaning", arti: "meaning", terjemahan: null } as const

    expect(batchProblems(files, match)).toEqual([
      "Meaning is chosen for 2 columns in 4 files: Bab 1.csv, Bab 2.csv, Bab 3.csv and 1 more. Pick one.",
      "7 files have no column for Term: Bab 1.csv, Bab 2.csv, Bab 3.csv and 4 more."
    ])
  })

  test("Term is listed before Meaning, and one file reads in the singular", () => {
    const files = [file("Bab 1.csv", ["kosakata"]), ...bab(4, 3, ["arti"])]
    const match = { kosakata: "term", arti: "meaning" } as const

    expect(batchProblems(files, match)).toEqual([
      "3 files have no column for Term: Bab 4.csv, Bab 5.csv, Bab 6.csv.",
      "1 file has no column for Meaning: Bab 1.csv."
    ])
  })

  test("a blank header shared by two columns of one file counts as two columns", () => {
    const match = { term: "term", meaning: "meaning", "": "notes" } as const

    expect(batchProblems([file("a.csv", ["term", "", "meaning", ""])], match)).toEqual([
      "Notes is chosen for 2 columns in 1 file: a.csv. Pick one."
    ])
  })
})
