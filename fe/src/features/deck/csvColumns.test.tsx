import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Effect, Result } from "effect";
import { ImportRejected } from "@voca/contract";
import type { ApiClient } from "../../lib/api";
import { session } from "../../lib/appSession";
import { CsvImportModal } from "./CsvImportModal";

const restore: Array<() => void> = [];

afterEach(() => {
  for (const undo of restore.splice(0)) undo();
});

const fakeImport = (answer: () => Effect.Effect<unknown, unknown> = () => Effect.succeed({ imported: 2, skippedDuplicates: 0 })) => {
  const payloads: FormData[] = [];

  const client = {
    library: {
      importCsv: ({ payload }: { payload: FormData }) => {
        payloads.push(payload);

        return answer();
      },
    },
  };

  const spy = spyOn(session, "call").mockImplementation(
    async (f) => (await Effect.runPromise(Effect.result(f(client as unknown as ApiClient)))) as never,
  );
  restore.push(() => spy.mockRestore());

  return payloads;
};

const csv = (content: string | Uint8Array<ArrayBuffer>, name = "kosakata-bab3.csv") =>
  new File([content], name, { type: "text/csv" });

const renderModal = () =>
  render(<CsvImportModal open deckSlug={"DECK000001" as never} onClose={() => {}} onImported={() => {}} />);

const importButton = () => screen.getByRole("button", { name: "Import" }) as HTMLButtonElement;

const chosen = (label: string) => (screen.getByLabelText(label) as HTMLSelectElement).selectedOptions[0]?.textContent;

const pick = async (content: string | Uint8Array<ArrayBuffer>) => {
  const user = userEvent.setup();

  renderModal();
  await user.upload(screen.getByLabelText("CSV file"), csv(content));
  await screen.findByText("Match columns");

  return user;
};

describe("Match columns in Import CSV", () => {
  test("before a file is picked: the hint, no template link, Import disabled", () => {
    renderModal();

    expect(screen.getByText("CSV with a header row · UTF-8 · up to 5 MB")).not.toBeNull();
    expect(screen.queryByText("Download template")).toBeNull();
    expect(importButton().disabled).toBe(true);
  });

  test("unknown names are listed in file order on Not imported, with a line per missing field", async () => {
    await pick("kosakata,arti,cara baca\n水,air,みず\n");

    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];

    expect(selects.map((select) => select.labels?.[0]?.textContent)).toEqual(["kosakata", "arti", "cara baca"]);
    expect(["kosakata", "arti", "cara baca"].map(chosen)).toEqual(["Not imported", "Not imported", "Not imported"]);
    expect(Array.from(selects[0]!.options).map((option) => option.textContent)).toEqual([
      "Not imported",
      "Term",
      "Meaning",
      "Reading",
      "Example",
      "Notes",
    ]);
    expect(screen.getByText("Choose a column for Term.")).not.toBeNull();
    expect(screen.getByText("Choose a column for Meaning.")).not.toBeNull();
    expect(importButton().disabled).toBe(true);
  });

  test("with Term and Meaning chosen, Import sends the matched columns", async () => {
    const payloads = fakeImport();
    const user = await pick("kosakata,arti,cara baca\n水,air,みず\n");

    await user.selectOptions(screen.getByLabelText("kosakata"), "Term");
    await user.selectOptions(screen.getByLabelText("arti"), "Meaning");

    expect(screen.queryByText("Choose a column for Term.")).toBeNull();
    expect(screen.queryByText("Choose a column for Meaning.")).toBeNull();
    expect(importButton().disabled).toBe(false);

    await user.click(importButton());

    expect(await screen.findByText("Imported 2 words")).not.toBeNull();
    expect(JSON.parse(String(payloads[0]!.get("columns")))).toEqual(["term", "meaning", null]);
  });

  test("known names start matched and Import is enabled without changes", async () => {
    await pick("Term, MEANING ,pinyin\n学习,belajar,xuéxí\n");

    expect(["Term", "MEANING", "pinyin"].map(chosen)).toEqual(["Term", "Meaning", "Reading"]);
    expect(importButton().disabled).toBe(false);
  });

  test("choosing a field another column has moves it there", async () => {
    const user = await pick("kosakata,arti\n水,air\n");

    await user.selectOptions(screen.getByLabelText("kosakata"), "Meaning");
    await user.selectOptions(screen.getByLabelText("arti"), "Meaning");

    expect(chosen("kosakata")).toBe("Not imported");
    expect(chosen("arti")).toBe("Meaning");
  });

  test("a blank header cell is listed as Column N (no name) and can be matched", async () => {
    const user = await pick("kosakata,,arti\n水,みず,air\n");

    await user.selectOptions(screen.getByLabelText("Column 2 (no name)"), "Reading");

    expect(chosen("Column 2 (no name)")).toBe("Reading");
  });

  test("a file that isn't UTF-8 can't be read: no columns, Import disabled", async () => {
    const user = userEvent.setup();

    renderModal();
    await user.upload(screen.getByLabelText("CSV file"), csv(new Uint8Array([0x6b, 0xff, 0xfe, 0x2c, 0x61, 0x0a])));

    expect(
      await screen.findByText("Can't read this file's header. Save it as CSV UTF-8 with a header row, then choose it again."),
    ).not.toBeNull();
    expect(screen.queryByText("Match columns")).toBeNull();
    expect(screen.queryAllByRole("combobox")).toEqual([]);
    expect(importButton().disabled).toBe(true);
  });

  test("a row error names the field and the Learner's column", async () => {
    fakeImport(() =>
      Effect.fail(
        new ImportRejected({
          message: "The file has 1 invalid row. Nothing was imported.",
          errors: [{ row: 14, column: "Meaning (arti)", message: "is required" }],
          totalErrors: 1,
        }),
      ),
    );
    const user = await pick("kosakata,arti\n水,air\n");

    await user.selectOptions(screen.getByLabelText("kosakata"), "Term");
    await user.selectOptions(screen.getByLabelText("arti"), "Meaning");
    await user.click(importButton());

    expect(await screen.findByText("Row 14, Meaning (arti): is required")).not.toBeNull();
  });

  test("choosing another file starts again from its header", async () => {
    const user = await pick("kosakata,arti\n水,air\n");

    await user.selectOptions(screen.getByLabelText("kosakata"), "Term");
    await user.upload(screen.getByLabelText("CSV file"), csv("kosakata,makna\n火,api\n", "bab4.csv"));

    await waitFor(() => expect(screen.queryByLabelText("makna")).not.toBeNull());
    expect(chosen("kosakata")).toBe("Not imported");
  });

  test("closing and reopening the modal discards the matches", async () => {
    const user = userEvent.setup();
    const modal = (open: boolean) => (
      <CsvImportModal open={open} deckSlug={"DECK000001" as never} onClose={() => {}} onImported={() => {}} />
    );
    const { rerender } = render(modal(true));

    await user.upload(screen.getByLabelText("CSV file"), csv("kosakata,arti\n水,air\n"));
    await user.selectOptions(await screen.findByLabelText("kosakata"), "Term");
    rerender(modal(false));
    rerender(modal(true));

    expect(screen.queryByText("Match columns")).toBeNull();
    expect(screen.queryAllByRole("combobox")).toEqual([]);
  });
});
