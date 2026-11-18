import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { SessionNotice } from "./SessionNotice";

test("the notice is a muted status line", () => {
  render(<SessionNotice notice="Only 3 of the 7 words you asked for were available today." />);

  const status = screen.getByRole("status");

  expect(status.classList.contains("muted")).toBe(true);
  expect(status.textContent).toBe("Only 3 of the 7 words you asked for were available today.");
});

test("no notice renders nothing", () => {
  const { container } = render(<SessionNotice notice={null} />);

  expect(container.innerHTML).toBe("");
});
