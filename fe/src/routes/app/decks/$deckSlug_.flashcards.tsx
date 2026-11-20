import { createFileRoute } from "@tanstack/react-router";
import { FlashcardsPage } from "../../../features/flashcards/FlashcardsPage";

// The trailing underscore keeps this route beside the deck page rather than inside its layout.
export const Route = createFileRoute("/app/decks/$deckSlug_/flashcards")({
  component: FlashcardsRoute,
});

function FlashcardsRoute() {
  const { deckSlug } = Route.useParams();
  return <FlashcardsPage deckSlug={deckSlug} />;
}
