import { createFileRoute } from "@tanstack/react-router";
import { DeckPage } from "../../../features/deck/DeckPage";

export const Route = createFileRoute("/app/decks/$deckSlug")({
  component: DeckRoute,
});

function DeckRoute() {
  const { deckSlug } = Route.useParams();
  return <DeckPage deckSlug={deckSlug} />;
}
