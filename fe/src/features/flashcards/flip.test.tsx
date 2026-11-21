import { afterEach, describe, expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Word } from "@voca/contract";
import { FlashcardRun } from "./FlashcardRun";

// A flip turns the card with an animation, every time and even when the Learner asks for reduced motion, and the
// back never repeats the term, even for a word with no reading.

const card = (slug: string, term: string, reading: string | null, meaning: string) =>
  ({ slug, term, reading, meaning, example: null, notes: null, createdAt: "2026-11-01T00:00:00.000Z" }) as unknown as Word;

const cards = [card("WRD000000002", "飲む", "のむ", "to drink"), card("WRD000000003", "ありがとう", null, "thank you")];

const cardFace = () => screen.getByRole("button", { name: /^Card/ });

const originalAnimate = HTMLElement.prototype.animate;
const originalMatchMedia = window.matchMedia;

// happy-dom plays no animation; a fake that finishes at once counts the turns.
const fakeAnimate = () => {
  const animate = mock(() => {
    const animation = {
      finished: Promise.resolve(),
      onfinish: null,
      cancel: () => {},
      finish: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    return animation as unknown as Animation;
  });

  HTMLElement.prototype.animate = animate as unknown as typeof HTMLElement.prototype.animate;

  return animate;
};

const preferReducedMotion = () => {
  window.matchMedia = ((query: string) =>
    ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
};

afterEach(() => {
  HTMLElement.prototype.animate = originalAnimate;
  window.matchMedia = originalMatchMedia;
});

describe("FlashcardRun flip", () => {
  test("the back shows the reading and meaning but never the term", async () => {
    fakeAnimate();
    const user = userEvent.setup();
    render(<FlashcardRun cards={cards} termLang="ja" backHref="/app/decks/DECK000001" />);

    await user.click(cardFace());

    expect(cardFace().textContent).toContain("のむ");
    expect(cardFace().textContent).toContain("to drink");
    expect(cardFace().textContent).not.toContain("飲む");
  });

  test("a word with no reading still keeps its term off the back", async () => {
    fakeAnimate();
    const user = userEvent.setup();
    render(<FlashcardRun cards={cards} termLang="ja" backHref="/app/decks/DECK000001" />);

    await user.click(screen.getByRole("button", { name: "Remembered" }));
    await user.click(cardFace());

    expect(cardFace().textContent).toContain("thank you");
    expect(cardFace().textContent).not.toContain("ありがとう");
  });

  test("every flip, to the back and to the front, plays the turn, even with reduced motion", async () => {
    const animate = fakeAnimate();
    preferReducedMotion();
    const user = userEvent.setup();
    render(<FlashcardRun cards={cards} termLang="ja" backHref="/app/decks/DECK000001" />);

    await user.click(cardFace());

    expect(cardFace().textContent).toContain("のむ");
    expect(animate.mock.calls.length).toBe(1);

    await user.click(cardFace());

    expect(cardFace().textContent).toContain("飲む");
    expect(animate.mock.calls.length).toBe(2);
  });
});
