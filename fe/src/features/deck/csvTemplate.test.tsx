import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { CsvImportModal } from "./CsvImportModal";

// The Import CSV modal offers the format as a file, so a Learner never has to guess the header.

const DATA_PREFIX = "data:text/csv;charset=utf-8,";

const renderModal = () =>
  render(<CsvImportModal open deckSlug={"DECK000001" as never} onClose={() => {}} onImported={() => {}} />);

describe("Download template in the Import CSV modal", () => {
  test("downloads voca-template.csv", () => {
    renderModal();

    const link = screen.getByRole("link", { name: "Download template" });

    expect(link.getAttribute("download")).toBe("voca-template.csv");
  });

  test("the file is UTF-8 and holds exactly the header line", () => {
    renderModal();

    const href = screen.getByRole("link", { name: "Download template" }).getAttribute("href") ?? "";
    const content = decodeURIComponent(href.slice(DATA_PREFIX.length));

    // A trailing line break is allowed; nothing else is.
    expect(content.replace(/\r?\n$/, "")).toBe("term,meaning,reading,example,notes");
    expect(href.startsWith(DATA_PREFIX)).toBe(true);
  });
});
