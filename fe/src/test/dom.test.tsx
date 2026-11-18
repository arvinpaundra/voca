import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      Clicked {count}
    </button>
  );
}

describe("component test setup", () => {
  test("renders a component and reacts to a click", async () => {
    const user = userEvent.setup();
    render(<Counter />);

    await user.click(screen.getByRole("button", { name: "Clicked 0" }));

    expect(screen.getByRole("button", { name: "Clicked 1" })).toBeDefined();
  });

  // happy-dom opens a native dialog but does not close it on Escape; components handle Escape themselves.
  test("a native dialog opens modally", () => {
    render(<dialog aria-label="Box">inside</dialog>);
    const dialog = screen.getByRole("dialog", { hidden: true }) as HTMLDialogElement;

    dialog.showModal();

    expect(dialog.open).toBe(true);
  });
});
