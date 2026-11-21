import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Word } from "@voca/contract";
import { FlashcardRun } from "./FlashcardRun";

// A touch drag across the card swipes it; a short touch, a vertical drag or a mouse drag is not a swipe.

const card = (slug: string, term: string) =>
  ({ slug, term, reading: null, meaning: `meaning of ${term}`, example: null, notes: null, createdAt: "2026-11-01T00:00:00.000Z" }) as unknown as Word;

const cards = [card("WRD000000001", "食べる"), card("WRD000000002", "飲む")];

const renderRun = () => render(<FlashcardRun cards={cards} termLang="ja" backHref="/app/decks/DECK000001" />);

const cardFace = () => screen.getByRole("button", { name: /^Card/ });

const drag = (from: { x: number; y: number }, to: { x: number; y: number }, pointerType = "touch") => {
  const face = cardFace();

  fireEvent.pointerDown(face, { pointerType, clientX: from.x, clientY: from.y });
  fireEvent.pointerUp(face, { pointerType, clientX: to.x, clientY: to.y });
};

describe("a swipe on the card", () => {
  test("a long drag to the right marks the card remembered", () => {
    renderRun();

    drag({ x: 100, y: 100 }, { x: 220, y: 110 });

    expect(cardFace().textContent).toContain("飲む");
    expect(screen.getByText("2 / 2")).toBeTruthy();
  });

  test("a long drag to the left marks the card not yet", () => {
    renderRun();

    drag({ x: 220, y: 100 }, { x: 100, y: 104 });

    expect(screen.getByText("2 / 2")).toBeTruthy();
  });

  test("a short touch is still a tap that flips the card", () => {
    renderRun();

    drag({ x: 100, y: 100 }, { x: 110, y: 101 });
    fireEvent.click(cardFace());

    expect(cardFace().textContent).toContain("食べる");
    expect(screen.getByText("1 / 2")).toBeTruthy();
    expect(cardFace().getAttribute("aria-label")).toContain("tap to turn back");
  });

  test("a mostly vertical drag does not swipe", () => {
    renderRun();

    drag({ x: 100, y: 100 }, { x: 150, y: 300 });

    expect(screen.getByText("1 / 2")).toBeTruthy();
  });

  test("a mouse drag does not swipe", () => {
    renderRun();

    drag({ x: 100, y: 100 }, { x: 260, y: 100 }, "mouse");

    expect(screen.getByText("1 / 2")).toBeTruthy();
  });

  test("the click after a swipe does not flip the card the swipe left", () => {
    renderRun();

    drag({ x: 100, y: 100 }, { x: 260, y: 100 });
    fireEvent.click(cardFace());

    expect(screen.getByText("2 / 2")).toBeTruthy();
    expect(cardFace().textContent).not.toContain("meaning of 飲む");
  });

  test("a cancelled touch does not swipe", () => {
    renderRun();

    const face = cardFace();

    fireEvent.pointerDown(face, { pointerType: "touch", clientX: 100, clientY: 100 });
    fireEvent.pointerCancel(face, { pointerType: "touch", clientX: 300, clientY: 100 });
    fireEvent.pointerUp(face, { pointerType: "touch", clientX: 300, clientY: 100 });

    expect(screen.getByText("1 / 2")).toBeTruthy();
  });
});

describe("the summary", () => {
  test("Back on the summary undoes the last swipe", () => {
    renderRun();

    fireEvent.click(screen.getByRole("button", { name: "Remembered" }));
    fireEvent.click(screen.getByRole("button", { name: "Not yet" }));

    const done = screen.getByRole("region", { name: "Flashcards summary" });
    expect(done.textContent).toContain("1 remembered");
    expect(done.textContent).toContain("1 not yet");

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByText("2 / 2")).toBeTruthy();
    expect(cardFace().textContent).toContain("飲む");
  });
});
