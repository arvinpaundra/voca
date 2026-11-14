import { Outlet, createRootRoute, redirect } from "@tanstack/react-router";
import { tokenStore } from "../lib/appSession";
import { authRedirect } from "../lib/authRedirect";

export const Route = createRootRoute({
  // Runs before every route, so the sign-in rules live in one place.
  beforeLoad: ({ location }) => {
    const to = authRedirect(location.pathname, tokenStore.getRefresh() !== null);

    if (to !== null) throw redirect({ to, replace: true });
  },
  component: () => <Outlet />,
});
