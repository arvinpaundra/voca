import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Effect, Result } from "effect";
import type { ApiClient } from "../../lib/api";
import { session, tokenStore } from "../../lib/appSession";
import { DangerZoneSection } from "./DangerZoneSection";
import { SettingsPage } from "./SettingsPage";

const EMAIL = "ada@example.com";

const HELP = "Deletes your decks and signs you out everywhere. This can’t be undone.";

const LOSSES = [
  "Your decks and their words are deleted, including the ones you published to Community.",
  "Copies other learners forked from your decks stay theirs.",
  "Your name, email and photo are removed from Voca.",
  "You’re signed out on every device.",
  "Signing in with this Google account again starts a new, empty account.",
];

const FAILURE = "Couldn’t delete your account. Nothing was deleted. Try again.";

const LEARNER = {
  slug: "ABCDEFGH",
  email: EMAIL,
  name: "Ada Lovelace",
  avatarUrl: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  settings: {
    timezone: "UTC",
    dayStartHour: 4,
    desiredRetention: 0.9,
    newPerDay: 20,
    defaultSessionSize: 10,
    defaultMode: "easy",
  },
};

type Outcome = "ok" | "fails" | "pending";

const restores: Array<() => void> = [];

afterEach(() => {
  restores.splice(0).forEach((restore) => restore());
  window.localStorage.clear();
});

const fakeApi = (outcome: Outcome = "ok") => {
  const sent: string[] = [];

  const client = {
    me: {
      get: () => Effect.succeed(LEARNER as never),
      delete: () => {
        sent.push("delete");
        return Effect.succeed(undefined as never);
      },
    },
  };

  const spy = spyOn(session, "call").mockImplementation(async (f) => {
    const value = await Effect.runPromise(f(client as unknown as ApiClient));

    if (outcome === "pending" && sent.length > 0) return new Promise<never>(() => {});
    if (outcome === "fails" && sent.length > 0) return Result.fail(new Error("500"));

    return Result.succeed(value);
  });

  const assign = spyOn(window.location, "assign").mockImplementation(() => {});

  restores.push(
    () => spy.mockRestore(),
    () => assign.mockRestore(),
  );

  return { sent, assign };
};

const zone = () => screen.getByRole("region", { name: "Danger zone" });

const dialog = () => screen.getByRole("dialog", { name: "Delete your account?" });

const confirmButton = () => within(dialog()).getByRole("button", { name: "Delete account" }) as HTMLButtonElement;

const emailInput = () => within(dialog()).getByLabelText(`Type ${EMAIL} to confirm`) as HTMLInputElement;

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(within(zone()).getByRole("button", { name: "Delete account" }));

  return dialog();
};

describe("Settings: Danger zone", () => {
  test("a Danger zone card with the Delete account row, its help and its button, word for word", () => {
    fakeApi();
    render(<DangerZoneSection email={EMAIL} />);

    expect(within(zone()).getByText("Delete account", { selector: "b" })).toBeTruthy();
    expect(within(zone()).getByText(HELP)).toBeTruthy();
    expect(within(zone()).getByRole("button", { name: "Delete account" })).toBeTruthy();
  });

  test("the Settings page ends with the Danger zone once the settings have loaded", async () => {
    fakeApi();
    render(<SettingsPage />);

    await screen.findByRole("region", { name: "Display" });

    if (screen.queryByRole("region", { name: "Danger zone" }) === null) {
      throw new Error("not implemented: AF: the Settings page shows no Danger zone");
    }

    const regions = screen.getAllByRole("region");
    expect(regions.at(-1)?.getAttribute("aria-labelledby")).toBe(zone().getAttribute("aria-labelledby"));
  });
});

describe("Delete your account? confirmation", () => {
  test("opens with the title, the subtitle, what happens word for word, and an empty email field", async () => {
    fakeApi();
    const user = userEvent.setup();
    render(<DangerZoneSection email={EMAIL} />);

    const modal = await open(user);

    expect(within(modal).getByText("This can’t be undone.")).toBeTruthy();
    expect(within(modal).getAllByRole("listitem").map((item) => item.textContent)).toEqual(LOSSES);
    expect(emailInput().value).toBe("");
    expect(within(modal).getByRole("button", { name: "Keep account" })).toBeTruthy();
  });

  test("Delete account is disabled until the typed text matches the email, ignoring case and spaces around it", async () => {
    fakeApi();
    const user = userEvent.setup();
    render(<DangerZoneSection email={EMAIL} />);
    await open(user);

    expect(confirmButton().disabled).toBe(true);

    await user.type(emailInput(), "ada@exam");
    expect(confirmButton().disabled).toBe(true);

    for (const typed of [EMAIL, "Ada@Example.COM", "  ada@example.com  "]) {
      await user.clear(emailInput());
      await user.type(emailInput(), typed);
      expect(confirmButton().disabled).toBe(false);
    }
  });

  test("Enter deletes only once the email matches", async () => {
    const { sent } = fakeApi();
    const user = userEvent.setup();
    render(<DangerZoneSection email={EMAIL} />);
    await open(user);

    await user.type(emailInput(), "ada@exam{Enter}");
    expect(sent).toEqual([]);

    await user.type(emailInput(), "ple.com{Enter}");
    await waitFor(() => expect(sent).toEqual(["delete"]));
  });

  const closings: Array<[string, (user: ReturnType<typeof userEvent.setup>) => Promise<void>]> = [
    ["Keep account", (user) => user.click(within(dialog()).getByRole("button", { name: "Keep account" }))],
    ["✕", (user) => user.click(within(dialog()).getByRole("button", { name: "Close" }))],
    ["Escape", (user) => user.keyboard("{Escape}")],
    ["a click outside", (user) => user.click(dialog())],
  ];

  for (const [way, close] of closings) {
    test(`${way} closes it, clears the typed text and deletes nothing`, async () => {
      const { sent, assign } = fakeApi();
      const user = userEvent.setup();
      render(<DangerZoneSection email={EMAIL} />);
      await open(user);
      await user.type(emailInput(), EMAIL);

      await close(user);

      expect(screen.queryByRole("dialog", { name: "Delete your account?" })).toBeNull();
      expect(sent).toEqual([]);
      expect(assign).not.toHaveBeenCalled();

      await open(user);
      expect(emailInput().value).toBe("");
    });
  }

  test("confirming deletes the account, clears the tokens and lands on the sign-in page with the notice", async () => {
    tokenStore.setRefresh("r".repeat(43));
    tokenStore.setAccess("access-token", 900, Date.now());
    const { sent, assign } = fakeApi("ok");
    const user = userEvent.setup();
    render(<DangerZoneSection email={EMAIL} />);
    await open(user);

    await user.type(emailInput(), EMAIL);
    await user.click(confirmButton());

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/login?deleted"));
    expect(sent).toEqual(["delete"]);
    expect(tokenStore.getRefresh()).toBeNull();
    expect(tokenStore.getAccess()).toBeNull();
  });

  test("while deleting, the modal shows Deleting… and can't be closed", async () => {
    fakeApi("pending");
    const user = userEvent.setup();
    render(<DangerZoneSection email={EMAIL} />);
    await open(user);

    await user.type(emailInput(), EMAIL);
    await user.click(confirmButton());

    const busy = await within(dialog()).findByRole("button", { name: "Deleting…" });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect((within(dialog()).getByRole("button", { name: "Keep account" }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(dialog()).getByRole("button", { name: "Close" }) as HTMLButtonElement).disabled).toBe(true);
    expect(emailInput().disabled).toBe(true);

    await user.keyboard("{Escape}");
    await user.click(dialog());

    expect(dialog()).toBeTruthy();
  });

  test("a failed delete keeps the modal open with the failure message and the typed text, and the tokens", async () => {
    tokenStore.setRefresh("r".repeat(43));
    const { assign } = fakeApi("fails");
    const user = userEvent.setup();
    render(<DangerZoneSection email={EMAIL} />);
    await open(user);

    await user.type(emailInput(), "Ada@Example.com");
    await user.click(confirmButton());

    const alert = await within(dialog()).findByRole("alert");
    expect(alert.textContent).toBe(FAILURE);
    expect(emailInput().value).toBe("Ada@Example.com");
    expect(confirmButton().disabled).toBe(false);
    expect(tokenStore.getRefresh()).toBe("r".repeat(43));
    expect(assign).not.toHaveBeenCalled();
  });
});
