import { createFileRoute } from "@tanstack/react-router";
import { DecksPage } from "../../../features/decks/DecksPage";

export const Route = createFileRoute("/app/decks/")({
  component: DecksPage,
});
