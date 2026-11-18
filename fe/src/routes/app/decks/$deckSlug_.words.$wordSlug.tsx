import { createFileRoute } from "@tanstack/react-router";
import { WordPage } from "../../../features/word/WordPage";

export const Route = createFileRoute("/app/decks/$deckSlug_/words/$wordSlug")({
  component: WordRoute,
});

function WordRoute() {
  const { deckSlug, wordSlug } = Route.useParams();
  return <WordPage deckSlug={deckSlug} wordSlug={wordSlug} />;
}
