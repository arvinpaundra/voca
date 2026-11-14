import { createFileRoute } from "@tanstack/react-router";
import { DeckPreviewPage } from "../../../features/discover/DeckPreviewPage";

export const Route = createFileRoute("/app/discover/$deckSlug")({
  component: DeckPreviewRoute,
});

function DeckPreviewRoute() {
  const { deckSlug } = Route.useParams();
  return <DeckPreviewPage deckSlug={deckSlug} />;
}
