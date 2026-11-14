import { createFileRoute } from "@tanstack/react-router";
import { DiscoverPage } from "../../../features/discover/DiscoverPage";

export const Route = createFileRoute("/app/discover/")({
  component: DiscoverPage,
});
