import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IMPORT_MAX_BYTES, IMPORT_MAX_FILES, IMPORT_MAX_TOTAL_BYTES } from "@voca/contract";
import { ImportDecksModal } from "./ImportDecksModal";

// The Import decks modal refuses a selection over 50 files or over 50 MB in all, before anything is sent.

/** A CSV file reporting `size` bytes, without allocating them. */
const csvOfSize = (name: string, size: number) => {
  const file = new File(["term,meaning\n"], name, { type: "text/csv" });

  Object.defineProperty(file, "size", { value: size });

  return file;
};

const importButton = () => screen.getByRole("button", { name: "Import" }) as HTMLButtonElement;

describe("the Import decks limits", () => {
  test("fifty files are accepted", async () => {
    const user = userEvent.setup();

    render(<ImportDecksModal open onClose={() => {}} />);

    const files = Array.from({ length: IMPORT_MAX_FILES }, (_, i) => csvOfSize(`deck ${i}.csv`, 1000));

    await user.upload(screen.getByLabelText("CSV files"), files);

    expect(screen.getByText("50 files chosen")).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(importButton().disabled).toBe(false);
  });

  test("fifty-one files are refused with a message and Import is disabled", async () => {
    const user = userEvent.setup();

    render(<ImportDecksModal open onClose={() => {}} />);

    const files = Array.from({ length: IMPORT_MAX_FILES + 1 }, (_, i) => csvOfSize(`deck ${i}.csv`, 1000));

    await user.upload(screen.getByLabelText("CSV files"), files);

    expect(screen.getByText("Choose at most 50 files. Nothing is imported.")).not.toBeNull();
    expect(importButton().disabled).toBe(true);
  });

  test("files totalling exactly 50 MB are accepted", async () => {
    const user = userEvent.setup();

    render(<ImportDecksModal open onClose={() => {}} />);

    const files = Array.from({ length: IMPORT_MAX_TOTAL_BYTES / IMPORT_MAX_BYTES }, (_, i) =>
      csvOfSize(`deck ${i}.csv`, IMPORT_MAX_BYTES)
    );

    await user.upload(screen.getByLabelText("CSV files"), files);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(importButton().disabled).toBe(false);
  });

  test("files totalling more than 50 MB are refused with a message and Import is disabled", async () => {
    const user = userEvent.setup();

    render(<ImportDecksModal open onClose={() => {}} />);

    const full = Array.from({ length: IMPORT_MAX_TOTAL_BYTES / IMPORT_MAX_BYTES }, (_, i) =>
      csvOfSize(`deck ${i}.csv`, IMPORT_MAX_BYTES)
    );

    await user.upload(screen.getByLabelText("CSV files"), [...full, csvOfSize("one more.csv", 1)]);

    expect(screen.getByText("Choose files totalling at most 50 MB. Nothing is imported.")).not.toBeNull();
    expect(importButton().disabled).toBe(true);
  });
});
