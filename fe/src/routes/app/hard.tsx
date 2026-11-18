import { createFileRoute } from "@tanstack/react-router";
import { HardWordsPage } from "../../features/hard/HardWordsPage";

export const Route = createFileRoute("/app/hard")({
  component: HardWordsPage,
});
