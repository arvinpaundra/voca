import { describe, expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import { DateTime } from "effect";
import type { DeckSnooze, DeckSummary } from "@voca/contract";
import { DeckRows } from "./DeckRows";
import { snoozeShortLabel } from "./snooze";

// A snoozed deck in the list reads as set aside: the row is dimmed with a moon before its title, its badge is short
// ("until 28 Nov") with the full label on hover and for screen readers, and its Study button is the plain one.

const until = (iso: string): DeckSnooze => ({ until: DateTime.makeUnsafe(iso) });

const deck = (slug: string, title: string, dueCount: number, snooze: DeckSnooze | null) =>
  ({
    slug,
    title,
    description: "",
    termLang: "ja",
    meaningLang: "en",
    visibility: "private",
    publishedAt: null,
    forkedFrom: null,
    forkCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    snooze,
    wordCount: 12,
    dueCount,
  }) as unknown as DeckSummary;

const sorted = (element: Element | null | undefined) => [...(element?.classList ?? [])].sort();

describe("snoozeShortLabel", () => {
  test("a timed snooze names the day it ends, without the weekday", () => {
    expect(snoozeShortLabel(until("2026-11-28T04:00:00.000Z"), "UTC")).toBe("until 28 Nov");
  });

  test("the day is the end's date in the Learner's timezone", () => {
    expect(snoozeShortLabel(until("2026-11-16T21:00:00.000Z"), "Asia/Jakarta")).toBe("until 17 Nov");
  });

  test("a snooze with no end says Snoozed", () => {
    expect(snoozeShortLabel({ until: null }, "UTC")).toBe("Snoozed");
  });

  test.each([null, undefined])("an awake deck (%p) says nothing", (snooze) => {
    expect(snoozeShortLabel(snooze, "UTC")).toBeNull();
  });
});

describe("DeckRows: a snoozed deck", () => {
  const decks = [
    deck("DECK000001", "Japanese N5 verbs", 20, until("2026-11-28T04:00:00.000Z")),
    deck("DECK000004", "Mandarin HSK 1", 9, { until: null }),
    deck("DECK000006", "Korean honorifics", 3, null),
  ];

  const rows = () => {
    render(<DeckRows decks={decks} timezone="UTC" onEdit={() => {}} onDelete={() => {}} />);

    return screen.getAllByRole("listitem");
  };

  test("its row is marked .snoozed, with a moon before the title", () => {
    const [timed, open] = rows();

    expect(timed!.innerHTML).toMatch(/<article class="deck snoozed"/);
    expect(timed!.innerHTML).toMatch(/class="deck-head"[\s\S]*lucide-moon[\s\S]*class="deck-title"/);
    expect(open!.innerHTML).toMatch(/<article class="deck snoozed"/);
  });

  test("a timed snooze: a short badge, the full label on hover and for screen readers", () => {
    const [timed] = rows();

    const badge = within(timed!).getByTitle("Snoozed until Sat 28 Nov");
    expect(sorted(badge)).toEqual(["badge", "badge-navy"]);
    expect(badge.querySelector('span[aria-hidden="true"]')?.textContent).toBe("until 28 Nov");
    expect(badge.querySelector(".sr-only")?.textContent).toBe("Snoozed until Sat 28 Nov");
  });

  test("a snooze with no end: the badge says Snoozed", () => {
    const [, open] = rows();

    const badge = within(open!).getByTitle("Snoozed");
    expect(badge.querySelector('span[aria-hidden="true"]')?.textContent).toBe("Snoozed");
    expect(badge.querySelector(".sr-only")?.textContent).toBe("Snoozed");
  });

  test("Study is the plain button even with words due", () => {
    const [timed] = rows();

    const study = within(timed!).getByRole("link", { name: "Study Japanese N5 verbs" });
    expect(sorted(study)).toEqual(["btn", "btn-secondary", "btn-sm"]);
    expect(study.getAttribute("href")).toBe("/app/decks/DECK000001/study");
  });

  test("an awake deck is unchanged: no mark, no moon, no badge, primary Study when due", () => {
    const [, , awake] = rows();

    expect(awake!.innerHTML).not.toMatch(/snoozed|lucide-moon/);
    expect(awake!.textContent).not.toContain("Snoozed");
    expect(sorted(within(awake!).getByRole("link", { name: "Study Korean honorifics" }))).toEqual([
      "btn",
      "btn-primary",
      "btn-sm",
    ]);
  });
});
