import { describe, expect, mock, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateTime } from "effect";
import type { DeckSnooze, DeckSummary, SnoozeDays } from "@voca/contract";
import { DeckRows } from "./DeckRows";
import { SelectionBar } from "./SelectionBar";
import { SnoozeModal } from "./SnoozeModal";
import { snoozeLabel } from "./snooze";

// Deck snooze in the library: the label a snoozed deck shows, the dialog that picks how long, the row checkboxes
// and the bar that acts on the selected decks.

const until = (iso: string): DeckSnooze => ({ until: DateTime.makeUnsafe(iso) });

const deck = (slug: string, title: string, snooze: DeckSnooze | null) =>
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
    dueCount: 3,
  }) as unknown as DeckSummary;

describe("snoozeLabel", () => {
  test("a timed snooze names the date it ends", () => {
    expect(snoozeLabel(until("2026-11-28T04:00:00.000Z"), "UTC")).toBe("Snoozed until Sat 28 Nov");
  });

  test("the date is the end's date in the Learner's timezone", () => {
    // 04:00 on 17 Nov in Jakarta is still 16 Nov in UTC.
    expect(snoozeLabel(until("2026-11-16T21:00:00.000Z"), "Asia/Jakarta")).toBe("Snoozed until Tue 17 Nov");
  });

  test("a snooze with no end says Snoozed", () => {
    expect(snoozeLabel({ until: null }, "UTC")).toBe("Snoozed");
  });

  test.each([null, undefined])("an awake deck (%p) says nothing", (snooze) => {
    expect(snoozeLabel(snooze, "UTC")).toBeNull();
  });
});

describe("SnoozeModal", () => {
  test.each([
    ["1 day", 1],
    ["3 days", 3],
    ["7 days", 7],
    ["14 days", 14],
    ["Until I unsnooze", null],
  ] as const)("%s snoozes for %p", async (name, days) => {
    const user = userEvent.setup();
    const onSnooze = mock((_days: SnoozeDays | null) => {});
    render(<SnoozeModal open count={1} onSnooze={onSnooze} onClose={() => {}} />);

    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name }));

    expect(onSnooze).toHaveBeenCalledTimes(1);
    expect(onSnooze).toHaveBeenCalledWith(days);
  });

  test.each([
    [1, "Snooze deck"],
    [3, "Snooze 3 decks"],
  ])("with %p deck(s) the title reads %s", (count, title) => {
    render(<SnoozeModal open count={count} onSnooze={() => {}} onClose={() => {}} />);

    expect(screen.getByRole("dialog", { name: title })).toBeTruthy();
  });

  test("closed, it renders nothing", () => {
    render(<SnoozeModal open={false} count={1} onSnooze={() => {}} onClose={() => {}} />);

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("DeckRows with snooze", () => {
  const decks = [
    deck("DECK000001", "Japanese N5 verbs", until("2026-11-28T04:00:00.000Z")),
    deck("DECK000004", "Mandarin HSK 1", { until: null }),
    deck("DECK000006", "Korean honorifics", null),
  ];

  test("each row has a checkbox that toggles its deck", async () => {
    const user = userEvent.setup();
    const onToggleSelect = mock((_deck: DeckSummary) => {});
    render(
      <DeckRows
        decks={decks}
        selected={new Set(["DECK000004"])}
        onToggleSelect={onToggleSelect}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    );

    const first = screen.getByRole("checkbox", { name: "Select Japanese N5 verbs" }) as HTMLInputElement;
    const second = screen.getByRole("checkbox", { name: "Select Mandarin HSK 1" }) as HTMLInputElement;
    expect(first.checked).toBe(false);
    expect(second.checked).toBe(true);

    await user.click(first);

    expect(onToggleSelect).toHaveBeenCalledWith(decks[0]!);
  });

  test("without a selection handler, rows have no checkbox", () => {
    render(<DeckRows decks={decks} onEdit={() => {}} onDelete={() => {}} />);

    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});

describe("SelectionBar", () => {
  test("names the count and offers Snooze, Unsnooze and Clear", async () => {
    const user = userEvent.setup();
    const onSnooze = mock(() => {});
    const onUnsnooze = mock(() => {});
    const onClear = mock(() => {});
    render(<SelectionBar count={2} onSnooze={onSnooze} onUnsnooze={onUnsnooze} onClear={onClear} />);

    const bar = screen.getByRole("region", { name: "Selected decks" });
    expect(bar.textContent).toContain("2 selected");

    await user.click(within(bar).getByRole("button", { name: "Snooze" }));
    await user.click(within(bar).getByRole("button", { name: "Unsnooze" }));
    await user.click(within(bar).getByRole("button", { name: "Clear" }));

    expect([onSnooze.mock.calls.length, onUnsnooze.mock.calls.length, onClear.mock.calls.length]).toEqual([1, 1, 1]);
  });
});
