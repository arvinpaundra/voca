import { createFileRoute } from "@tanstack/react-router";
import { StudySetupPage } from "../../../features/study/SetupPage";

// The trailing underscore keeps this route beside the deck page rather than inside its layout.
export const Route = createFileRoute("/app/decks/$deckSlug_/study")({
  component: StudySetupRoute,
});

function StudySetupRoute() {
  const { deckSlug } = Route.useParams();
  return <StudySetupPage deckSlug={deckSlug} />;
}
