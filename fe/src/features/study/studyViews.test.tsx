import { describe, expect, mock, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SessionSize } from "@voca/contract";
import { AnswerOptions } from "./AnswerOptions";
import { SessionSizeField } from "./SessionSizeField";
import { SessionSummary } from "./SessionSummary";
import { SessionTally } from "./SessionTally";
import { Verdict } from "./Verdict";

// Markup and class names follow the study screens of docs/design/ui-refinement.html (Console).

const options = [
  { wordSlug: "A", text: "to drink" },
  { wordSlug: "B", text: "to eat" },
  { wordSlug: "C", text: "to see" },
  { wordSlug: "D", text: "to sleep" },
];

const sorted = (element: Element | null | undefined) => [...(element?.classList ?? [])].sort();

describe("AnswerOptions", () => {
  test("four .opt buttons in an .options group, each with its key", () => {
    render(<AnswerOptions options={options} correctSlug={null} chosenSlug={null} onChoose={() => {}} />);

    const group = screen.getByRole("group", { name: "Answers" });
    expect(group.classList.contains("options")).toBe(true);

    const buttons = within(group).getAllByRole("button");
    expect(buttons).toHaveLength(4);
    expect(buttons.map((button) => button.textContent)).toEqual(["1to drink", "2to eat", "3to see", "4to sleep"]);
    expect(buttons.every((button) => sorted(button).join() === "opt")).toBe(true);
    expect(buttons[0]?.querySelector("kbd")?.textContent).toBe("1");
    expect(buttons[0]?.querySelector(".grow")?.textContent).toBe("to drink");
  });

  test("keys 1 to 4 choose an answer; other keys do nothing", async () => {
    const user = userEvent.setup();
    const onChoose = mock((_slug: string) => {});
    render(<AnswerOptions options={options} correctSlug={null} chosenSlug={null} onChoose={onChoose} />);

    screen.getByRole("group", { name: "Answers" });
    await user.keyboard("5");
    await user.keyboard("2");

    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith("B");
  });

  test("answered wrong: the chosen option is .wrong, the right one .right, the rest .dim, all locked", async () => {
    const user = userEvent.setup();
    const onChoose = mock((_slug: string) => {});
    render(<AnswerOptions options={options} correctSlug="B" chosenSlug="A" onChoose={onChoose} />);

    const buttons = within(screen.getByRole("group", { name: "Answers" })).getAllByRole("button");

    expect(buttons.map((button) => sorted(button).join(" "))).toEqual(["opt wrong", "opt right", "dim opt", "dim opt"]);
    expect(buttons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);

    await user.keyboard("1");
    expect(onChoose).not.toHaveBeenCalled();
  });
});

describe("Verdict", () => {
  test("a wrong answer: the .verdict.no bar names the answer and holds Next", async () => {
    const user = userEvent.setup();
    const onNext = mock(() => {});
    render(<Verdict correct={false} term="食べる" answer="to eat" onNext={onNext} />);

    const verdict = screen.getByRole("status");
    expect(sorted(verdict)).toEqual(["no", "verdict"]);
    expect(verdict.textContent).toContain("Not quite. 食べる means “to eat”. It comes back later in this session.");

    const next = within(verdict).getByRole("button", { name: "Next" });
    expect(sorted(next)).toEqual(["btn", "btn-primary", "btn-sm"]);

    await user.click(next);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  test("a right answer: .verdict.ok", () => {
    render(<Verdict correct term="食べる" answer="to eat" onNext={() => {}} />);

    const verdict = screen.getByRole("status");

    expect(sorted(verdict)).toEqual(["ok", "verdict"]);
    expect(verdict.textContent).toContain("Correct. 食べる means “to eat”.");
  });
});

describe("SessionTally", () => {
  test("the This session card: words cleared and the right, wrong, accuracy tally", () => {
    render(<SessionTally cleared={8} size={20} right={7} wrong={2} />);

    const card = screen.getByRole("complementary", { name: "This session" });
    expect(card.classList.contains("card")).toBe(true);
    expect(within(card).getByRole("heading", { level: 2, name: "This session" }).classList.contains("h2")).toBe(true);

    expect(card.querySelector(".kpi .v")?.textContent).toBe("8 / 20");
    expect(card.querySelector(".kpi .l")?.textContent).toBe("words cleared");
    expect([...card.querySelectorAll(".tally > div")].map((row) => row.textContent)).toEqual([
      "Right7",
      "Wrong2",
      "Accuracy78%",
    ]);
  });
});

describe("SessionSummary", () => {
  test("the .complete card: medal, title, the answer strip, numbers and the ways out", () => {
    render(<SessionSummary firstAttempts={[true, true, false, true, true, true, true, true, true, false]} backHref="/app/decks/DECK000001" />);

    const title = screen.getByRole("heading", { level: 1, name: "Session complete" });
    const card = title.closest(".card.complete");
    expect(card).not.toBeNull();
    expect(card?.querySelector(".medal")).not.toBeNull();

    const strip = [...(card?.querySelectorAll(".strip i") ?? [])];
    expect(strip.map((mark) => mark.className)).toEqual(["r", "r", "w", "r", "r", "r", "r", "r", "r", "w"]);

    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual(["right", "wrong", "accuracy"]);
    expect(screen.getAllByRole("definition").map((value) => value.textContent)).toEqual(["8", "2", "80%"]);

    const back = screen.getByRole("link", { name: "Back to deck" });
    expect(back.getAttribute("href")).toBe("/app/decks/DECK000001");
    expect(sorted(back)).toEqual(["btn", "btn-primary"]);

    const dashboard = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboard.getAttribute("href")).toBe("/app");
    expect(sorted(dashboard)).toEqual(["btn", "btn-secondary"]);
  });

  test("accuracy without answers is a dash", () => {
    render(<SessionSummary firstAttempts={[]} backHref="/app" />);

    expect(screen.getAllByRole("definition").at(-1)?.textContent).toBe("—");
  });
});

describe("SessionSizeField", () => {
  test("the sizes are a full-width segmented choice", async () => {
    const user = userEvent.setup();
    const onChange = mock((_size: SessionSize) => {});
    render(<SessionSizeField value={10} onChange={onChange} />);

    const group = screen.getByRole("radiogroup", { name: "Session size" });
    expect(sorted(group)).toEqual(["full", "seg"]);
    expect(within(group).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["7", "10", "15", "20"]);
    expect(within(group).getByRole("radio", { name: "10", checked: true })).toBeDefined();

    await user.click(within(group).getByRole("radio", { name: "15" }));
    expect(onChange).toHaveBeenCalledWith(15);
  });
});
