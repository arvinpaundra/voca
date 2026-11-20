import { describe, expect, test } from "bun:test";
import { render, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from "@tanstack/react-router";
import type { Learner, Notifications } from "@voca/contract";
import { AppShell } from "./AppShell";
import { AppDataProvider, type AppDataLoaders } from "./appData";

// The shell reads the learner from the shared context. It must not fetch the learner itself.

const learnerNamed = (name: string) => ({ name, email: "ada@example.com" }) as unknown as Learner;

const counts = { decks: [], hardDue: 0, newAvailable: 0, estimatedMinutes: null } as unknown as Notifications;

const renderShell = (loaders: AppDataLoaders) => {
  const rootRoute = createRootRoute({
    component: () => (
      <AppDataProvider loaders={loaders}>
        <AppShell>
          <p>page</p>
        </AppShell>
      </AppDataProvider>
    ),
  });

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/app"] }),
  });

  return render(<RouterProvider router={router} />);
};

describe("AppShell", () => {
  test("renders the learner's name from the context, without its own request", async () => {
    let learnerCalls = 0;

    const loaders: AppDataLoaders = {
      learner: async () => {
        learnerCalls += 1;
        return learnerNamed("Ada");
      },
      notifications: async () => counts,
    };

    renderShell(loaders);

    await waitFor(() => expect(document.querySelector(".side-user")?.textContent).toContain("Ada"));

    expect(learnerCalls).toBe(1);
  });
});
