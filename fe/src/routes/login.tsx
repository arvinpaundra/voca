import { createFileRoute, redirect } from "@tanstack/react-router";
import { SignInPage } from "../features/auth/SignInPage";
import { tokenStore } from "../lib/appSession";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (tokenStore.getRefresh() !== null) throw redirect({ to: "/" });
  },
  component: SignInPage,
});
