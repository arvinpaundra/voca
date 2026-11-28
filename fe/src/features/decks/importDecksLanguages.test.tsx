import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Effect, Result } from "effect";
import type { ApiClient } from "../../lib/api";
import { session } from "../../lib/appSession";
import { ImportDecksModal } from "./ImportDecksModal";
import { languageOptions } from "./languages";

// The Import decks modal picks its two languages with the same picker as the create-deck modal.

const restore: Array<() => void> = [];

afterEach(() => {
  for (const undo of restore.splice(0)) undo();
});

// A fake client that records every importDecks payload and answers with an empty batch.
const fakeImports = () => {
  const payloads: FormData[] = [];

  const client = {
    imports: {
      importDecks: ({ payload }: { payload: FormData }) => {
        payloads.push(payload);

        return Effect.succeed({ slug: "BATCH00000000001", termLang: "ja", meaningLang: "en", createdAt: null, files: [] } as never);
      },
    },
  };

  const spy = spyOn(session, "call").mockImplementation(async (f) =>
    Result.succeed(await Effect.runPromise(f(client as unknown as ApiClient)))
  );
  restore.push(() => spy.mockRestore());

  return payloads;
};

const csv = (name: string) => new File(["term,meaning\n"], name, { type: "text/csv" });

const optionLabels = (label: string) =>
  Array.from((screen.getByLabelText(label) as HTMLSelectElement).options).map((option) => option.textContent);

describe("the Import decks language pickers", () => {
  test("both offer the create-deck modal's languages, then Other…", () => {
    render(<ImportDecksModal open onClose={() => {}} />);

    const expected = [...languageOptions().map((option) => option.label), "Other…"];

    expect(optionLabels("Term language")).toEqual(expected);
    expect(optionLabels("Meaning language")).toEqual(expected);
  });

  test("an offered language is sent as its tag", async () => {
    const user = userEvent.setup();
    const payloads = fakeImports();

    render(<ImportDecksModal open onClose={() => {}} />);

    await user.upload(screen.getByLabelText("CSV files"), [csv("N5 verbs.csv")]);

    await screen.findByText("Match columns");
    await user.selectOptions(screen.getByLabelText("Term language"), "ko");
    await user.selectOptions(screen.getByLabelText("Meaning language"), "id");
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(payloads).toHaveLength(1);
    expect(payloads[0]!.get("termLang")).toBe("ko");
    expect(payloads[0]!.get("meaningLang")).toBe("id");
  });

  test("Other… takes a typed tag, such as yue or a tag outside the list", async () => {
    const user = userEvent.setup();
    const payloads = fakeImports();

    render(<ImportDecksModal open onClose={() => {}} />);

    await user.upload(screen.getByLabelText("CSV files"), [csv("Cantonese.csv")]);

    await screen.findByText("Match columns");
    await user.selectOptions(screen.getByLabelText("Term language"), "other");
    await user.type(screen.getByLabelText("Term language code"), "yue");
    await user.selectOptions(screen.getByLabelText("Meaning language"), "other");
    await user.type(screen.getByLabelText("Meaning language code"), "tl");
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(payloads).toHaveLength(1);
    expect(payloads[0]!.get("termLang")).toBe("yue");
    expect(payloads[0]!.get("meaningLang")).toBe("tl");
  });

  test("a malformed typed tag is refused and nothing is sent", async () => {
    const user = userEvent.setup();
    const payloads = fakeImports();

    render(<ImportDecksModal open onClose={() => {}} />);

    await user.upload(screen.getByLabelText("CSV files"), [csv("N5 verbs.csv")]);

    await screen.findByText("Match columns");
    await user.selectOptions(screen.getByLabelText("Term language"), "other");
    await user.type(screen.getByLabelText("Term language code"), "japanese");
    await user.selectOptions(screen.getByLabelText("Meaning language"), "en");
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(screen.getByText("Use a language code like ja or en")).not.toBeNull();
    expect(payloads).toEqual([]);
  });
});
