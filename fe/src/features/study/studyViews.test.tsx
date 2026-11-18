import { describe, expect, mock, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SessionSize } from "@voca/contract";
import { AnswerOptions } from "./AnswerOptions";
import { SessionSizeField } from "./SessionSizeField";
import { SessionSummary } from "./SessionSummary";

const options = [
  { wordSlug: "A", text: "Alpha" },
  { wordSlug: "B", text: "Beta" },
  { wordSlug: "C", text: "Gamma" },
  { wordSlug: "D", text: "Delta" },
];

describe("AnswerOptions", () => {
  test("four numbered answers in a group", () => {
    render(<AnswerOptions options={options} correctSlug={null} chosenSlug={null} onChoose={() => {}} />);

    const group = screen.getByRole("group", { name: "Answers" });
    const buttons = within(group).getAllByRole("button");

    expect(buttons).toHaveLength(4);
    expect(buttons.map((button) => button.textContent)).toEqual(["1Alpha", "2Beta", "3Gamma", "4Delta"]);
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

  test("a wrong answer names the right one and locks the options", async () => {
    const user = userEvent.setup();
    const onChoose = mock((_slug: string) => {});
    render(<AnswerOptions options={options} correctSlug="C" chosenSlug="A" onChoose={onChoose} />);

    expect(within(screen.getByRole("status")).getByText("Wrong. The answer is Gamma.")).toBeDefined();

    const buttons = within(screen.getByRole("group", { name: "Answers" })).getAllByRole("button");
    expect(buttons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);

    await user.keyboard("1");
    expect(onChoose).not.toHaveBeenCalled();
  });

  test("a right answer says so", () => {
    render(<AnswerOptions options={options} correctSlug="B" chosenSlug="B" onChoose={() => {}} />);

    expect(within(screen.getByRole("status")).getByText("Correct.")).toBeDefined();
  });
});

describe("SessionSummary", () => {
  test("the session's numbers and the ways out", () => {
    render(<SessionSummary right={7} wrong={3} backHref="/app/decks/DECK000001" />);

    expect(screen.getByRole("heading", { level: 1, name: "Session complete" })).toBeDefined();
    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual(["Right", "Wrong", "Accuracy"]);
    expect(screen.getAllByRole("definition").map((value) => value.textContent)).toEqual(["7", "3", "70%"]);
    expect(screen.getByRole("link", { name: "Back to deck" }).getAttribute("href")).toBe("/app/decks/DECK000001");
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("href")).toBe("/app");
  });

  test("accuracy without answers is a dash", () => {
    render(<SessionSummary right={0} wrong={0} backHref="/app" />);

    expect(screen.getAllByRole("definition").at(-1)?.textContent).toBe("—");
  });
});

describe("SessionSizeField", () => {
  test("the sizes are a segmented choice", async () => {
    const user = userEvent.setup();
    const onChange = mock((_size: SessionSize) => {});
    render(<SessionSizeField value={10} onChange={onChange} />);

    const group = screen.getByRole("radiogroup", { name: "Session size" });
    expect(within(group).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["7", "10", "15", "20"]);
    expect(within(group).getByRole("radio", { name: "10", checked: true })).toBeDefined();

    await user.click(within(group).getByRole("radio", { name: "15" }));
    expect(onChange).toHaveBeenCalledWith(15);
  });
});
