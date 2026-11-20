import { describe, expect, mock, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Learner, Notifications } from "@voca/contract";
import { AppDataProvider, useAppData, type AppDataLoaders } from "./appData";

// The shell loads the Learner and the counts once and shares them. Two consumers must not mean two requests.

const learnerNamed = (name: string) => ({ name, email: "ada@example.com" }) as unknown as Learner;

const counts = (due: number) =>
  ({ decks: [], hardDue: 0, newAvailable: due, estimatedMinutes: null }) as unknown as Notifications;

/** Loaders that count their calls, so a test can tell one request from two. */
const spyLoaders = (
  learner: Learner | null = learnerNamed("Ada"),
  notifications: Notifications | null = counts(3),
) => {
  const calls = { learner: 0, notifications: 0 };

  const loaders: AppDataLoaders = {
    learner: async () => {
      calls.learner += 1;
      return learner;
    },
    notifications: async () => {
      calls.notifications += 1;
      return notifications;
    },
  };

  return { loaders, calls };
};

function Consumer({ label }: { label: string }) {
  const { learner, notifications } = useAppData();

  return (
    <div data-testid={label}>
      {learner.kind === "loaded" ? learner.value.name : learner.kind}
      {" · "}
      {notifications.kind === "loaded" ? String(notifications.value.newAvailable) : notifications.kind}
    </div>
  );
}

function Rename() {
  const { setLearner } = useAppData();

  return (
    <button type="button" onClick={() => setLearner(learnerNamed("Grace"))}>
      rename
    </button>
  );
}

function Reload() {
  const { reloadNotifications } = useAppData();

  return (
    <button type="button" onClick={reloadNotifications}>
      reload
    </button>
  );
}

const text = (label: string) => screen.getByTestId(label).textContent;

describe("AppDataProvider", () => {
  test("two consumers share one request per endpoint", async () => {
    const { loaders, calls } = spyLoaders();

    render(
      <AppDataProvider loaders={loaders}>
        <Consumer label="one" />
        <Consumer label="two" />
      </AppDataProvider>,
    );

    await waitFor(() => expect(text("one")).toBe("Ada · 3"));

    expect(calls).toEqual({ learner: 1, notifications: 1 });
    expect(text("one")).toBe("Ada · 3");
    expect(text("two")).toBe("Ada · 3");
  });

  test("a failed call fails only its own slice", async () => {
    const { loaders } = spyLoaders(null, counts(7));

    render(
      <AppDataProvider loaders={loaders}>
        <Consumer label="one" />
      </AppDataProvider>,
    );

    await screen.findByText("failed · 7", { exact: false });

    expect(text("one")).toBe("failed · 7");
  });

  test("setLearner reaches every consumer without another request", async () => {
    const user = userEvent.setup();
    const { loaders, calls } = spyLoaders();

    render(
      <AppDataProvider loaders={loaders}>
        <Consumer label="one" />
        <Consumer label="two" />
        <Rename />
      </AppDataProvider>,
    );

    await waitFor(() => expect(text("one")).toBe("Ada · 3"));
    await user.click(screen.getByRole("button", { name: "rename" }));

    expect(text("one")).toBe("Grace · 3");
    expect(text("two")).toBe("Grace · 3");
    expect(calls.learner).toBe(1);
  });

  test("reloadNotifications asks for the counts again, and only those", async () => {
    const user = userEvent.setup();
    const { loaders, calls } = spyLoaders();

    render(
      <AppDataProvider loaders={loaders}>
        <Consumer label="one" />
        <Reload />
      </AppDataProvider>,
    );

    await screen.findByText("Ada · 3", { exact: false });
    await user.click(screen.getByRole("button", { name: "reload" }));

    await Promise.resolve();

    expect(calls.notifications).toBe(2);
    expect(calls.learner).toBe(1);
  });

  test("a consumer outside the provider says so", () => {
    const quiet = mock(() => {});
    const error = console.error;
    console.error = quiet;

    expect(() => render(<Consumer label="one" />)).toThrow(/AppDataProvider/);

    console.error = error;
  });
});
