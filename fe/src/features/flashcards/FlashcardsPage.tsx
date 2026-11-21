import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Option, Result, Schema } from "effect";
import { DeckSlug, type SessionSize, type Word } from "@voca/contract";
import { ArrowLeft } from "lucide-react";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import { session } from "../../lib/appSession";
import { deckQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { FlashcardRun } from "./FlashcardRun";
import { FlashcardSetup } from "./FlashcardSetup";

type PageState =
  | { readonly kind: "setup"; readonly error: string | null }
  | { readonly kind: "starting" }
  | { readonly kind: "running"; readonly run: number; readonly cards: ReadonlyArray<Word> };

// Pages through one deck's cards: every run asks the server again, so each one is a fresh shuffle.
export function FlashcardsPage({ deckSlug }: { deckSlug: string }) {
  // A URL segment is a plain string; the API takes a DeckSlug, so a malformed one never leaves the page.
  const parsed = Option.getOrNull(Schema.decodeUnknownOption(DeckSlug)(deckSlug));

  if (parsed === null) return <ErrorState message="This deck could not be loaded." />;

  return <FlashcardsDeck deckSlug={parsed} />;
}

function FlashcardsDeck({ deckSlug }: { deckSlug: DeckSlug }) {
  const deckResult = useQuery(deckQuery(deckSlug), queryClient);
  const [state, setState] = useState<PageState>({ kind: "setup", error: null });

  const deck = deckResult.data;

  if (deck === undefined) {
    if (deckResult.isError) return <ErrorState message="This deck could not be loaded." />;

    return <Skeleton label="Loading deck" rows={3} />;
  }

  const deckHref = `/app/decks/${deckSlug}`;

  const start = (size: SessionSize | undefined) => {
    setState({ kind: "starting" });

    session
      .call((client) =>
        client.library.flashcards({
          params: { deckSlug },
          query: size === undefined ? {} : { size },
        }),
      )
      .then((result) => {
        if (Result.isSuccess(result)) {
          setState((previous) => ({
            kind: "running",
            run: previous.kind === "running" ? previous.run + 1 : 1,
            cards: result.success,
          }));
        } else {
          setState({ kind: "setup", error: "The cards could not be loaded." });
        }
      });
  };

  return (
    <>
      <a className="back" href={deckHref} style={{ marginBottom: 16 }}>
        <ArrowLeft className="i" aria-hidden="true" />
        {deck.title}
      </a>

      {state.kind === "setup" && (
        <>
          <FlashcardSetup wordCount={deck.wordCount ?? 0} onStart={start} />
          {state.error !== null && <ErrorState message={state.error} />}
        </>
      )}

      {state.kind === "starting" && <Skeleton label="Shuffling cards" rows={3} />}

      {state.kind === "running" && (
        <FlashcardRun key={state.run} cards={state.cards} termLang={deck.termLang} backHref={deckHref} />
      )}
    </>
  );
}
