import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Deck } from "@voca/contract";
import { DeckModal } from "./DeckModal";

// The language fields are a picker of the offered languages, with an "Other…" escape for any other tag.

const deck = {
  slug: "DECK000001",
  title: "Japanese N5 verbs",
  description: "",
  termLang: "ja",
  meaningLang: "en",
} as unknown as Deck;

describe("the deck form's language pickers", () => {
  test("an offered language shows as its name, and no code field appears", () => {
    render(<DeckModal open deck={deck} onClose={() => {}} onSaved={() => {}} />);

    expect((screen.getByLabelText("Term language") as HTMLSelectElement).value).toBe("ja");
    expect((screen.getByLabelText("Meaning language") as HTMLSelectElement).value).toBe("en");
    expect(screen.queryByLabelText("Term language code")).toBeNull();
  });

  test("Other reveals a free-text tag, so a language outside the list stays reachable", async () => {
    const user = userEvent.setup();

    render(<DeckModal open deck={{ ...deck, termLang: "fi" } as Deck} onClose={() => {}} onSaved={() => {}} />);

    expect((screen.getByLabelText("Term language") as HTMLSelectElement).value).toBe("other");
    expect((screen.getByLabelText("Term language code") as HTMLInputElement).value).toBe("fi");

    await user.selectOptions(screen.getByLabelText("Meaning language"), "other");

    expect(screen.getByLabelText("Meaning language code")).not.toBeNull();
  });

  test("choosing an offered language hides the code field again", async () => {
    const user = userEvent.setup();

    render(<DeckModal open deck={{ ...deck, termLang: "fi" } as Deck} onClose={() => {}} onSaved={() => {}} />);

    await user.selectOptions(screen.getByLabelText("Term language"), "ko");

    expect(screen.queryByLabelText("Term language code")).toBeNull();
    expect((screen.getByLabelText("Term language") as HTMLSelectElement).value).toBe("ko");
  });
});
