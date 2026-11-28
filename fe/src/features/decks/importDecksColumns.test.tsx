import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Effect, Result } from "effect";
import type { ApiClient } from "../../lib/api";
import { session } from "../../lib/appSession";
import { ImportDecksModal } from "./ImportDecksModal";

const restore: Array<() => void> = [];

afterEach(() => {
  for (const undo of restore.splice(0)) undo();
});

const fakeImports = () => {
  const payloads: FormData[] = [];

  const client = {
    imports: {
      importDecks: ({ payload }: { payload: FormData }) => {
        payloads.push(payload);

        return Effect.succeed({ slug: "BATCH00000000001", termLang: "ja", meaningLang: "id", createdAt: null, files: [] } as never);
      },
    },
  };

  const spy = spyOn(session, "call").mockImplementation(async (f) =>
    Result.succeed(await Effect.runPromise(f(client as unknown as ApiClient))),
  );
  restore.push(() => spy.mockRestore());

  return payloads;
};

const csv = (name: string, content: string | Uint8Array<ArrayBuffer>) => new File([content], name, { type: "text/csv" });

const bab = (from: number, count: number, header: string) =>
  Array.from({ length: count }, (_, i) => csv(`Bab ${from + i}.csv`, `${header}\n語,kata\n`));

const importButton = () => screen.getByRole("button", { name: "Import" }) as HTMLButtonElement;

const chosen = (label: string) => (screen.getByLabelText(label) as HTMLSelectElement).selectedOptions[0]?.textContent;

const rowNames = () => (screen.getAllByRole("combobox") as HTMLSelectElement[])
  .filter((select) => !["Term language", "Meaning language"].includes(select.labels?.[0]?.textContent ?? ""))
  .map((select) => select.labels?.[0]?.textContent);

const pick = async (files: File[], onClose: () => void = () => {}) => {
  const user = userEvent.setup();

  render(<ImportDecksModal open onClose={onClose} />);
  await user.upload(screen.getByLabelText("CSV files"), files);
  await screen.findByText("Match columns");
  await user.selectOptions(screen.getByLabelText("Term language"), "ja");
  await user.selectOptions(screen.getByLabelText("Meaning language"), "id");

  return user;
};

describe("Match columns in Import decks", () => {
  test("the hint reads 5 MB each, and there is no template link", () => {
    render(<ImportDecksModal open onClose={() => {}} />);

    expect(screen.getByText("CSV with a header row · UTF-8 · 5 MB each")).not.toBeNull();
    expect(screen.queryByText("Download template")).toBeNull();
  });

  test("50 files with the same names in two orders list 3 rows, each in 50 files, and import with one match", async () => {
    const payloads = fakeImports();
    const files = [
      ...Array.from({ length: 25 }, (_, i) => csv(`Bab ${i}.csv`, "kosakata,arti,cara baca\n語,kata,ご\n")),
      ...Array.from({ length: 25 }, (_, i) => csv(`Bab ${25 + i}.csv`, "cara baca,kosakata,arti\nご,語,kata\n")),
    ];
    const user = await pick(files);

    expect(rowNames()).toEqual(["kosakata", "arti", "cara baca"]);
    expect(screen.getAllByText("50 files")).toHaveLength(3);

    await user.selectOptions(screen.getByLabelText("kosakata"), "Term");
    await user.selectOptions(screen.getByLabelText("arti"), "Meaning");
    await user.selectOptions(screen.getByLabelText("cara baca"), "Reading");
    await user.click(importButton());

    const columns = JSON.parse(String(payloads[0]!.get("columns")));

    expect(columns).toHaveLength(50);
    expect(columns[0]).toEqual(["term", "meaning", "reading"]);
    expect(columns[49]).toEqual(["reading", "term", "meaning"]);
  });

  test("different names may share a field: 30 kosakata,arti and 20 word,translation,notes files import", async () => {
    const payloads = fakeImports();
    const user = await pick([...bab(1, 30, "kosakata,arti"), ...bab(31, 20, "word,translation,notes")]);

    expect(rowNames()).toEqual(["kosakata", "arti", "word", "translation", "notes"]);
    expect(chosen("notes")).toBe("Notes");

    await user.selectOptions(screen.getByLabelText("kosakata"), "Term");
    await user.selectOptions(screen.getByLabelText("word"), "Term");
    await user.selectOptions(screen.getByLabelText("arti"), "Meaning");
    await user.selectOptions(screen.getByLabelText("translation"), "Meaning");

    expect(screen.queryByRole("alert")).toBeNull();
    expect(importButton().disabled).toBe(false);

    await user.click(importButton());

    const columns = JSON.parse(String(payloads[0]!.get("columns")));

    expect(columns[0]).toEqual(["term", "meaning"]);
    expect(columns[30]).toEqual(["term", "meaning", "notes"]);
  });

  test("a file with two columns on Meaning is named and Import is disabled", async () => {
    const user = await pick([...bab(1, 3, "kosakata,arti"), ...bab(4, 3, "kosakata,terjemahan"), csv("Bab 7.csv", "kosakata,arti,terjemahan\n")]);

    await user.selectOptions(screen.getByLabelText("kosakata"), "Term");
    await user.selectOptions(screen.getByLabelText("arti"), "Meaning");
    await user.selectOptions(screen.getByLabelText("terjemahan"), "Meaning");

    expect(screen.getByText("Meaning is chosen for 2 columns in 1 file: Bab 7.csv. Pick one.")).not.toBeNull();
    expect(importButton().disabled).toBe(true);
  });

  test("files with no column for Meaning are named and Import is disabled", async () => {
    const user = await pick([...bab(1, 3, "kosakata,arti"), ...bab(4, 3, "kosakata,terjemahan")]);

    await user.selectOptions(screen.getByLabelText("kosakata"), "Term");
    await user.selectOptions(screen.getByLabelText("arti"), "Meaning");

    expect(screen.getByText("3 files have no column for Meaning: Bab 4.csv, Bab 5.csv, Bab 6.csv.")).not.toBeNull();
    expect(importButton().disabled).toBe(true);
  });

  test("an unreadable file is listed with Remove; Import stays disabled until it is removed", async () => {
    const user = await pick([...bab(1, 2, "term,meaning"), csv("Bab 8.csv", new Uint8Array([0x6b, 0xff, 0xfe, 0x0a]))]);

    expect(screen.getByText(/Can't read this file's header\. Save it as CSV UTF-8 with a header row\./)).not.toBeNull();
    expect(screen.getByText("Bab 8.csv")).not.toBeNull();
    expect(importButton().disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: "Remove Bab 8.csv" }));

    expect(screen.queryByText(/Can't read this file's header/)).toBeNull();
    expect(screen.getByText("2 files chosen")).not.toBeNull();
    expect(importButton().disabled).toBe(false);
  });

  test("on Import the modal closes and the batch goes to the Imports panel", async () => {
    const payloads = fakeImports();
    let closed = false;
    const user = await pick(bab(1, 2, "term,meaning"), () => {
      closed = true;
    });

    await user.click(importButton());

    await waitFor(() => expect(closed).toBe(true));
    expect(payloads).toHaveLength(1);
  });

  test("choosing other files starts again from their headers", async () => {
    const user = await pick(bab(1, 2, "kosakata,arti"));

    await user.selectOptions(screen.getByLabelText("kosakata"), "Term");
    await user.upload(screen.getByLabelText("CSV files"), bab(3, 2, "kosakata,makna"));

    await waitFor(() => expect(screen.queryByLabelText("makna")).not.toBeNull());
    expect(chosen("kosakata")).toBe("Not imported");
  });
});
