import { afterEach, describe, expect, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { DateTime } from "effect";
import { AppShell } from "../../components/AppShell";
import { activityQuery, dueDecksQuery, learnerStatsQuery, meQuery, notificationsQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { cacheSession } from "../../test/cacheSession";
import { SettingsPage } from "../settings/SettingsPage";
import { DashboardPage } from "./DashboardPage";
import { studyDate } from "./dashboardModel";

// The dashboard, the shell and Settings read through the shared query cache: cached data renders at once, with no
// request, and a write refreshes what it changed.

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
    newPerDay: 10,
    defaultSessionSize: 10,
    defaultMode: "easy",
  },
};

const notifications = {
  decks: [{ deckSlug: "DECK000001", title: "Japanese N5 verbs", due: 7, overdue: 0, byDrill: [] }],
  hardDue: 0,
  newAvailable: 0,
  estimatedMinutes: null,
};

const stats = {
  maturity: { new: 0, learning: 0, mature: 0 },
  dueToday: 7,
  overdue: 0,
  forecast: [],
  trueRetention: null,
  calibration: null,
  reviewsPerDay: [],
  streak: { days: 0, studiedToday: false },
};

const seedLearner = () => queryClient.setQueryData(meQuery().queryKey, learner as never);

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
});

describe("cached pages", () => {
  test("the dashboard renders its cached sections without a request", async () => {
    seedLearner();
    queryClient.setQueryData(learnerStatsQuery().queryKey, stats as never);
    queryClient.setQueryData(notificationsQuery().queryKey, notifications as never);
    queryClient.setQueryData(dueDecksQuery().queryKey, { pages: [{ items: [], nextCursor: null, total: 0, termLangs: [] }], pageParams: [undefined] } as never);
    // The heatmap opens on the Learner's current study month.
    const month = studyDate(DateTime.nowUnsafe(), "UTC", 4).slice(0, 7);
    queryClient.setQueryData(activityQuery(month as never).queryKey, { month, days: [] } as never);
    const api = cacheSession("QB");
    restore = api.restore;

    render(<DashboardPage />);
    await api.expectNoReads("DashboardPage");

    expect(screen.getByRole("heading", { name: /Arvin/ })).toBeTruthy();
    expect(screen.getByText("Japanese N5 verbs")).toBeTruthy();
  });

  test("the shell renders the cached learner and due badge without a request", async () => {
    seedLearner();
    queryClient.setQueryData(notificationsQuery().queryKey, notifications as never);
    const api = cacheSession("QB");
    restore = api.restore;

    // The shell's nav links need a router; a one-route memory router is enough.
    const root = createRootRoute({
      component: () => (
        <AppShell>
          <p>page</p>
        </AppShell>
      ),
    });
    const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ["/app"] }) });

    render(<RouterProvider router={router} />);
    await screen.findByText("page");
    await api.expectNoReads("AppShell");

    expect(screen.getAllByText("Arvin Paundra").length).toBeGreaterThan(0);
    expect(screen.getAllByText("7").length).toBeGreaterThan(0);
  });

  test("Settings renders the cached learner without a request", async () => {
    seedLearner();
    const api = cacheSession("QB");
    restore = api.restore;

    render(<SettingsPage />);
    await api.expectNoReads("SettingsPage");

    expect((screen.getByRole("textbox", { name: "New words per day" }) as HTMLInputElement).value).toBe("10");
  });
});

describe("writes", () => {
  test("saving Settings refreshes the cached learner", async () => {
    seedLearner();
    const user = userEvent.setup();
    const saved = { ...learner, settings: { ...learner.settings, newPerDay: 15 } };
    const api = cacheSession("QB", {
      "me.updateSettings": () => saved,
      "me.get": () => saved,
    });
    restore = api.restore;

    render(<SettingsPage />);
    await api.expectNoReads("SettingsPage");

    const newPerDay = screen.getByRole("textbox", { name: "New words per day" });
    await user.clear(newPerDay);
    await user.type(newPerDay, "15");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(api.calls).toContain("me.get"));
    expect(api.calls[0]).toBe("me.updateSettings");
  });
});
