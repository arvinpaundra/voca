import { Outlet, createRootRoute, redirect, useRouterState } from "@tanstack/react-router";
import { AppShell } from "../components/AppShell";
import { tokenStore } from "../lib/appSession";
import { authRedirect, isAppPath } from "../lib/authRedirect";

export const Route = createRootRoute({
  // Runs before every route, so the sign-in rules live in one place.
  beforeLoad: ({ location }) => {
    const to = authRedirect(location.pathname, tokenStore.getRefresh() !== null);

    if (to !== null) throw redirect({ to, replace: true });
  },
  component: RootComponent,
});

function RootComponent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  // The shell stays mounted while moving between app pages, so its deck list loads once.
  if (!isAppPath(pathname)) return <Outlet />;

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
