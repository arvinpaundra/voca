import { describe, expect, mock, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Mode } from "@voca/contract";
import { ModeField } from "./ModeField";

const sorted = (element: Element | null | undefined) => [...(element?.classList ?? [])].sort();

describe("ModeField", () => {
  test("easy and hard are a full-width segmented choice, the given mode checked", () => {
    render(<ModeField value="hard" onChange={() => {}} />);

    const group = screen.getByRole("radiogroup", { name: "Mode" });
    expect(sorted(group)).toEqual(["full", "seg"]);
    expect(within(group).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Easy", "Hard"]);
    expect(within(group).getByRole("radio", { name: "Hard", checked: true })).toBeDefined();
    expect(within(group).getByRole("radio", { name: "Easy", checked: false })).toBeDefined();
  });

  test("choosing a mode reports it", async () => {
    const user = userEvent.setup();
    const onChange = mock((_mode: Mode) => {});
    render(<ModeField value="easy" onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: "Hard" }));
    expect(onChange).toHaveBeenCalledWith("hard");

    await user.click(screen.getByRole("radio", { name: "Easy" }));
    expect(onChange).toHaveBeenCalledWith("easy");
  });
});
