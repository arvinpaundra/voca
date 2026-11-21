import { useEffect, useState } from "react";
import { Option, Result, Schema } from "effect";
import { DeckSlug, type DeckDetail, type SessionSize, type Word } from "@voca/contract";
import { ArrowLeft } from "lucide-react";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import { session } from "../../lib/appSession";
import { FlashcardRun } from "./FlashcardRun";
import { FlashcardSetup } from "./FlashcardSetup";

type PageState =
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | { readonly kind: "setup"; readonly deck: DeckDetail; readonly error: string | null }
  | { readonly kind: "starting"; readonly deck: DeckDetail }
  | { readonly kind: "running"; readonly deck: DeckDetail; readonly run: number; readonly cards: ReadonlyArray<Word> };

// Pages through one deck's cards: every run asks the server again, so each one is a fresh shuffle.
export function FlashcardsPage({ deckSlug }: { deckSlug: string }) {
  const [state, setState] = useState<PageState>({ kind: "loading" });

  // A URL segment is a plain string; the API takes a DeckSlug, so a malformed one never leaves the page.
  const parsedSlug = Option.getOrNull(Schema.decodeUnknownOption(DeckSlug)(deckSlug));

  useEffect(() => {
    let active = true;

    if (parsedSlug === null) {
      setState({ kind: "failed" });
      return;
    }

    setState({ kind: "loading" });

    session.call((client) => client.library.getDeck({ params: { deckSlug: parsedSlug } })).then((result) => {
      if (!active) return;
      if (Result.isSuccess(result)) setState({ kind: "setup", deck: result.success, error: null });
      else setState({ kind: "failed" });
    });

    return () => {
      active = false;
    };
  }, [parsedSlug]);

  if (state.kind === "loading") {
    return <Skeleton label="Loading deck" rows={3} />;
  }

  if (state.kind === "failed") {
    return <ErrorState message="This deck could not be loaded." />;
  }

  const deckHref = `/app/decks/${deckSlug}`;

  const start = (deck: DeckDetail, size: SessionSize | undefined) => {
    if (parsedSlug === null) return;

    setState({ kind: "starting", deck });

    session
      .call((client) =>
        client.library.flashcards({
          params: { deckSlug: parsedSlug },
          query: size === undefined ? {} : { size },
        }),
      )
      .then((result) => {
        if (Result.isSuccess(result)) {
          setState((previous) => ({
            kind: "running",
            deck,
            run: previous.kind === "running" ? previous.run + 1 : 1,
            cards: result.success,
          }));
        } else {
          setState({ kind: "setup", deck, error: "The cards could not be loaded." });
        }
      });
  };

  return (
    <>
      <a className="back" href={deckHref} style={{ marginBottom: 16 }}>
        <ArrowLeft className="i" aria-hidden="true" />
        {state.deck.title}
      </a>

      {state.kind === "setup" && (
        <>
          <FlashcardSetup wordCount={state.deck.wordCount ?? 0} onStart={(size) => start(state.deck, size)} />
          {state.error !== null && <ErrorState message={state.error} />}
        </>
      )}

      {state.kind === "starting" && <Skeleton label="Shuffling cards" rows={3} />}

      {state.kind === "running" && (
        <FlashcardRun
          key={state.run}
          cards={state.cards}
          termLang={state.deck.termLang}
          backHref={deckHref}
        />
      )}
    </>
  );
}
