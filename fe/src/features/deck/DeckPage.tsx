import { useEffect, useState } from "react";
import { Option, Result, Schema } from "effect";
import { DeckSlug, type Deck } from "@voca/contract";
import { session } from "../../lib/appSession";
import { DeckView } from "./DeckView";

export function DeckPage({ deckSlug }: { deckSlug: string }) {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setDeck(null);
    setFailed(false);

    // A URL segment is a plain string; the API takes a DeckSlug, so a malformed one never leaves the page.
    const parsed = Schema.decodeUnknownOption(DeckSlug)(deckSlug);
    if (Option.isNone(parsed)) {
      setFailed(true);
      return;
    }

    session.call((client) => client.library.getDeck({ params: { deckSlug: parsed.value } })).then((result) => {
      if (!active) return;
      if (Result.isSuccess(result)) setDeck(result.success);
      else setFailed(true);
    });

    return () => {
      active = false;
    };
  }, [deckSlug]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      {deck !== null && <DeckView deck={deck} onDeckChanged={setDeck} />}
      {deck === null && failed && (
        <p className="text-sm text-red-600" role="alert">
          This deck could not be loaded.
        </p>
      )}
      {deck === null && !failed && <p className="text-sm text-stone-500">Loading…</p>}
    </div>
  );
}
