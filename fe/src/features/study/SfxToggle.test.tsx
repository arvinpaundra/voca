import { beforeEach, describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SfxToggle } from "./SfxToggle";
import { isMuted } from "./sfx";

// The mute button of the session header.

beforeEach(() => {
  window.localStorage.clear();
});

describe("SfxToggle", () => {
  test("sound on: the button offers to mute and is not pressed", () => {
    render(<SfxToggle />);

    const button = screen.getByRole("button", { name: "Mute sound effects" });

    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  test("a click mutes, keeps it on the device, and the label flips", async () => {
    const user = userEvent.setup();
    render(<SfxToggle />);

    await user.click(screen.getByRole("button", { name: "Mute sound effects" }));

    const button = screen.getByRole("button", { name: "Unmute sound effects" });

    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(isMuted()).toBe(true);
  });

  test("a second click turns sound back on", async () => {
    const user = userEvent.setup();
    render(<SfxToggle />);

    await user.click(screen.getByRole("button", { name: "Mute sound effects" }));
    await user.click(screen.getByRole("button", { name: "Unmute sound effects" }));

    expect(screen.getByRole("button", { name: "Mute sound effects" })).toBeTruthy();
    expect(isMuted()).toBe(false);
  });

  test("a stored mute shows on the first render", () => {
    window.localStorage.setItem("voca.sfx", "off");

    render(<SfxToggle />);

    expect(screen.getByRole("button", { name: "Unmute sound effects" })).toBeTruthy();
  });
});
