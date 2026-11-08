import { createFileRoute } from "@tanstack/react-router";
import { SignInPage } from "../features/auth/SignInPage";

export const Route = createFileRoute("/login")({
  component: SignInPage,
});
