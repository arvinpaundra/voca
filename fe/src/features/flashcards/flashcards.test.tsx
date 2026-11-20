import { describe, expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SessionSize, Word } from "@voca/contract";
import { FlashcardRun } from "./FlashcardRun";
import { FlashcardSetup } from "./FlashcardSetup";

// The flashcard screens: the size picker, and a run whose front shows only the term. Flipping shows the reading,
// meaning, example and notes; Remembered and Not yet (or → and ←) move on; Back undoes; the summary counts.

const card = (slug: string, term: string, reading: string | null, meaning: string, example: string | null, notes: string | null) =>
  ({ slug, term, reading, meaning, example, notes, createdAt: "2026-11-01T00:00:00.000Z" }) as unknown as Word;

const cards = [
  card("WRD000000001", "食べる", "たべる", "to eat", "朝ごはんを食べる", "ichidan verb"),
  card("WRD000000002", "飲む", "のむ", "to drink", null, null),
  card("WRD000000003", "ありがとう", null, "thank you", null, null),
];

const renderRun = () =>
  render(<FlashcardRun cards={cards} termLang="ja" backHref="/app/decks/DECK000001" />);

const cardFace = () => screen.getByRole("button", { name: /^Card/ });

describe("FlashcardSetup", () => {
  test.each([
    ["7", 7],
    ["10", 10],
    ["15", 15],
    ["20", 20],
    ["All", undefined],
  ] as const)("%s starts a run of %p", async (name, size) => {
    const user = userEvent.setup();
    const onStart = mock((_size: SessionSize | undefined) => {});
    render(<FlashcardSetup wordCount={30} onStart={onStart} />);

    await user.click(screen.getByRole("radio", { name }));
    await user.click(screen.getByRole("button", { name: "Start flashcards" }));

    expect(onStart).toHaveBeenCalledWith(size);
  });

  test("an empty deck can't start", () => {
    render(<FlashcardSetup wordCount={0} onStart={() => {}} />);

    expect((screen.getByRole("button", { name: "Start flashcards" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("FlashcardRun", () => {
  test("the front shows the term only, in the deck's language", () => {
    renderRun();

    const face = cardFace();
    expect(face.textContent).toContain("食べる");
    expect(face.textContent).not.toContain("たべる");
    expect(face.textContent).not.toContain("to eat");
    expect(face.querySelector("ruby, rt")).toBeNull();
    expect(screen.getByText("食べる").getAttribute("lang")).toBe("ja");
    expect(screen.getByText("1 / 3")).toBeTruthy();
  });

  test("a click flips it to the reading, meaning, example and notes", async () => {
    const user = userEvent.setup();
    renderRun();

    await user.click(cardFace());

    const face = cardFace();
    expect(face.textContent).toContain("たべる");
    expect(face.textContent).toContain("to eat");
    expect(face.textContent).toContain("朝ごはんを食べる");
    expect(face.textContent).toContain("ichidan verb");
  });

  test("Remembered and Not yet move to the next card, front up", async () => {
    const user = userEvent.setup();
    renderRun();

    await user.click(cardFace());
    await user.click(screen.getByRole("button", { name: "Remembered" }));

    expect(cardFace().textContent).toContain("飲む");
    expect(cardFace().textContent).not.toContain("to drink");
    expect(screen.getByText("2 / 3")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Not yet" }));

    expect(cardFace().textContent).toContain("ありがとう");
  });

  test("→ means remembered and ← means not yet", async () => {
    const user = userEvent.setup();
    renderRun();

    await user.keyboard("{ArrowRight}");
    await user.keyboard("{ArrowLeft}");
    await user.keyboard("{ArrowLeft}");

    const done = screen.getByRole("region", { name: "Flashcards summary" });
    expect(done.textContent).toContain("1 remembered");
    expect(done.textContent).toContain("2 not yet");
  });

  test("Back returns to the previous card and undoes its swipe", async () => {
    const user = userEvent.setup();
    renderRun();

    expect((screen.getByRole("button", { name: "Back" }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: "Remembered" }));
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(cardFace().textContent).toContain("食べる");
    expect(screen.getByText("1 / 3")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Not yet" }));
    await user.click(screen.getByRole("button", { name: "Not yet" }));
    await user.click(screen.getByRole("button", { name: "Not yet" }));

    const done = screen.getByRole("region", { name: "Flashcards summary" });
    expect(done.textContent).toContain("0 remembered");
    expect(done.textContent).toContain("3 not yet");
  });

  test("the summary links back to the deck", async () => {
    const user = userEvent.setup();
    renderRun();

    for (let i = 0; i < 3; i++) await user.click(screen.getByRole("button", { name: "Remembered" }));

    const done = screen.getByRole("region", { name: "Flashcards summary" });
    expect(done.textContent).toContain("3 remembered");
    expect(screen.getByRole("link", { name: "Back to deck" }).getAttribute("href")).toBe("/app/decks/DECK000001");
  });
});
