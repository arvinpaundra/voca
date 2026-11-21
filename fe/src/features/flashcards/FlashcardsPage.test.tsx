import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { FlashcardsPage } from "./FlashcardsPage";

// A URL segment that isn't a deck slug never reaches the API: the page says the deck could not be loaded.

describe("FlashcardsPage", () => {
  test("a malformed deck slug shows the error without asking the API", () => {
    render(<FlashcardsPage deckSlug="not-a-slug" />);

    expect(screen.getByRole("alert").textContent).toContain("This deck could not be loaded.");
  });
});
