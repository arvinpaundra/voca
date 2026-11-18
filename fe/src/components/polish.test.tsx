import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { IconButton } from "./IconButton";
import { Menu } from "./Menu";
import { navItems } from "./nav";

// The follow-ups to the Console design: the sidebar's items (Hard words added), the vertical "more" dots,
// and the round icon button of the study screen.

describe("sidebar", () => {
  test("Dashboard, Decks, Hard words, Discover, Settings", () => {
    expect(navItems().map((item) => [item.label, item.to, item.exact])).toEqual([
      ["Dashboard", "/app", true],
      ["Decks", "/app/decks", false],
      ["Hard words", "/app/hard", false],
      ["Discover", "/app/discover", false],
      ["Settings", "/app/settings", false],
    ]);
  });
});

describe("icons", () => {
  test("menus open from the design's vertical dots", () => {
    render(<Menu label="Deck actions" items={[{ label: "Edit deck", onSelect: () => {} }]} />);

    const trigger = screen.getByRole("button", { name: "Deck actions" });

    expect(trigger.innerHTML).toContain("lucide-ellipsis-vertical");
  });

  test("a round icon button is .btn-icon.round", () => {
    render(
      <IconButton label="Close session" round>
        <svg aria-hidden="true" />
      </IconButton>,
    );

    expect([...screen.getByRole("button", { name: "Close session" }).classList].sort()).toEqual(["btn-icon", "round"]);
  });
});
