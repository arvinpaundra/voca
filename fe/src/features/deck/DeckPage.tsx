import { useQuery } from "@tanstack/react-query";
import { Option, Schema } from "effect";
import { DeckSlug } from "@voca/contract";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import { deckQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { DeckView } from "./DeckView";

export function DeckPage({ deckSlug }: { deckSlug: string }) {
  // A URL segment is a plain string; the API takes a DeckSlug, so a malformed one never leaves the page.
  const parsed = Option.getOrNull(Schema.decodeUnknownOption(DeckSlug)(deckSlug));

  if (parsed === null) return <ErrorState message="This deck could not be loaded." />;

  return <LoadedDeck deckSlug={parsed} />;
}

function LoadedDeck({ deckSlug }: { deckSlug: DeckSlug }) {
  const deck = useQuery(deckQuery(deckSlug), queryClient);

  if (deck.data === undefined) {
    if (deck.isError) return <ErrorState message="This deck could not be loaded." />;

    return <Skeleton label="Loading deck" rows={3} />;
  }

  return <DeckView deck={deck.data} />;
}
