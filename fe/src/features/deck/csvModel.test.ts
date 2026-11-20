import { describe, expect, test } from "bun:test";
import { ImportRejected, NotFound, PayloadTooLarge } from "@voca/contract";
import { exportFileName, importFailure, importSummary } from "./csvModel";

describe("importSummary", () => {
  test.each([
    [{ imported: 12, skippedDuplicates: 3 }, "Imported 12 words · skipped 3 duplicates"],
    [{ imported: 1, skippedDuplicates: 1 }, "Imported 1 word · skipped 1 duplicate"],
    [{ imported: 5, skippedDuplicates: 0 }, "Imported 5 words"],
    [{ imported: 0, skippedDuplicates: 4 }, "Imported 0 words · skipped 4 duplicates"],
  ])("%o → %s", (result, line) => {
    expect(importSummary(result as never)).toBe(line);
  });
});

describe("importFailure", () => {
  test("a rejected file lists its row errors, with the column when there is one, and counts the rest", () => {
    const error = new ImportRejected({
      message: "The file has errors. Nothing was imported.",
      errors: [
        { row: 1, column: "colour", message: "Unknown column" },
        { row: 501, column: "meaning", message: "Meaning is required" },
        { row: 7, column: null, message: "Unclosed quote" },
      ],
      totalErrors: 150,
    });

    expect(importFailure(error)).toEqual({
      message: "The file has errors. Nothing was imported.",
      rows: ["Row 1, colour: Unknown column", "Row 501, meaning: Meaning is required", "Row 7: Unclosed quote"],
      more: 147,
    });
  });

  test("a file over the limit says so", () => {
    expect(importFailure(new PayloadTooLarge({ message: "too large" }))).toEqual({
      message: "The file is larger than 5 MB.",
      rows: [],
      more: 0,
    });
  });

  test("a deck that is gone says so", () => {
    expect(importFailure(new NotFound({ message: "Deck not found" })).message).toBe("This deck no longer exists.");
  });

  test("anything else asks to try again", () => {
    expect(importFailure(new Error("network down"))).toEqual({
      message: "Could not import the file. Try again.",
      rows: [],
      more: 0,
    });
  });
});

describe("exportFileName", () => {
  test("is the deck's slug as a .csv file", () => {
    expect(exportFileName("k3m9x2p7qa")).toBe("k3m9x2p7qa.csv");
  });
});
