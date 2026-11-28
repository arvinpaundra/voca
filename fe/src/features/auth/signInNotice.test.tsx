import { afterEach, describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { SignInPage } from "./SignInPage";

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

const deletedNotice = () => screen.queryByRole("status");

describe("SignInPage after an account delete", () => {
  test("shows the deleted notice once, and a reload shows the page without it", () => {
    window.history.replaceState(null, "", "/login?deleted");

    const first = render(<SignInPage />);

    if (deletedNotice() === null) throw new Error("not implemented: AF: the sign-in page shows no deleted notice");

    expect(deletedNotice()?.textContent).toBe("Your account has been deleted.");
    expect(window.location.search).toBe("");
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();

    first.unmount();
    render(<SignInPage />);

    expect(deletedNotice()).toBeNull();
  });

  test("a plain sign-in page has no notice", () => {
    window.history.replaceState(null, "", "/login");

    render(<SignInPage />);

    expect(deletedNotice()).toBeNull();
  });
});
