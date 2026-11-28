import { afterEach, describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { meQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { cacheSession } from "../../test/cacheSession";
import { SettingsPage } from "./SettingsPage";

const learner = {
  slug: "LRN000001",
  email: "learner@example.com",
  name: "Arvin Paundra",
  avatarUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  settings: {
    timezone: "UTC",
    dayStartHour: 4,
    desiredRetention: 0.9,
    newPerDay: 30,
    defaultSessionSize: 10,
    defaultMode: "easy",
  },
};

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
});

describe("the New cards per day setting", () => {
  test("names what it counts, says it is a target, and keeps the saved value", async () => {
    queryClient.setQueryData(meQuery().queryKey, learner as never);
    const api = cacheSession("NF");
    restore = api.restore;

    render(<SettingsPage />);
    await api.expectNoReads("SettingsPage");

    const input = screen.getByRole("textbox", { name: "New cards per day" }) as HTMLInputElement;
    const row = input.closest(".set-row") as HTMLElement;

    expect(input.value).toBe("30");
    expect(row.querySelector(".lbl b")?.textContent?.startsWith("New cards per day")).toBe(true);
    expect(row.querySelector(".lbl > span")?.textContent).toBe("A daily target. Reaching it doesn't stop new cards.");
    expect(screen.queryByText("New words per day")).toBeNull();
  });

  test("the info icon after the label explains what a card is", async () => {
    queryClient.setQueryData(meQuery().queryKey, learner as never);
    const user = userEvent.setup();
    const api = cacheSession("NF");
    restore = api.restore;

    render(<SettingsPage />);
    await api.expectNoReads("SettingsPage");

    const info = screen.getByRole("button", { name: "What is a card?" });

    expect(info.closest(".lbl b")).not.toBeNull();
    expect(screen.queryByRole("tooltip")).toBeNull();

    await user.hover(info);

    expect(screen.getByRole("tooltip").textContent).toBe("A card is one word in one drill.");
  });
});
