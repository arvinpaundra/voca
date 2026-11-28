import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip } from "./Tooltip";

const TIP = "A card is one word in one drill.";

const renderTip = () =>
  render(
    <div>
      <p>
        New cards per day <Tooltip label="What is a card?">{TIP}</Tooltip>
      </p>
      <button type="button">Elsewhere</button>
    </div>,
  );

const button = () => screen.getByRole("button", { name: "What is a card?" });

const shown = () => screen.queryByRole("tooltip");

describe("Tooltip", () => {
  test("closed at first; the button names what it explains", () => {
    renderTip();

    expect(button()).toBeTruthy();
    expect(shown()).toBeNull();
  });

  test("hover opens it, and the pointer leaving closes it", async () => {
    const user = userEvent.setup();
    renderTip();

    await user.hover(button());

    expect(shown()?.textContent).toBe(TIP);
    expect(button().getAttribute("aria-describedby")).toBe(shown()?.id ?? "missing");

    await user.unhover(button());

    expect(shown()).toBeNull();
  });

  test("keyboard focus opens it; Escape closes it, and so does moving the focus away", async () => {
    const user = userEvent.setup();
    renderTip();

    await user.tab();

    expect(document.activeElement).toBe(button());
    expect(shown()?.textContent).toBe(TIP);

    await user.keyboard("{Escape}");

    expect(shown()).toBeNull();

    await user.tab({ shift: true });
    await user.tab();

    expect(shown()?.textContent).toBe(TIP);

    await user.tab();

    expect(document.activeElement?.textContent).toBe("Elsewhere");
    expect(shown()).toBeNull();
  });

  test("a tap opens it, and a tap elsewhere closes it", async () => {
    const user = userEvent.setup();
    renderTip();

    fireEvent.click(button());

    expect(shown()?.textContent).toBe(TIP);

    await user.click(screen.getByText("Elsewhere"));

    expect(shown()).toBeNull();
  });
});
