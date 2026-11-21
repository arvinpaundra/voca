import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "../features/landing/LandingPage";
import { tokenStore } from "../lib/appSession";

export const Route = createFileRoute("/")({
  component: () => <LandingPage signedIn={tokenStore.getRefresh() !== null} />,
});
