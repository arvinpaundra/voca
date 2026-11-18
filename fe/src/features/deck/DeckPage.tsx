import { useEffect, useState } from "react";
import { Option, Result, Schema } from "effect";
import { DeckSlug, type DeckDetail } from "@voca/contract";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import { session } from "../../lib/appSession";
import { DeckView } from "./DeckView";

export function DeckPage({ deckSlug }: { deckSlug: string }) {
  const [deck, setDeck] = useState<DeckDetail | null>(null);
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
    <>
      {deck !== null && <DeckView deck={deck} onDeckChanged={(changed) => setDeck((previous) => ({ ...previous, ...changed }))} />}
      {deck === null && failed && <ErrorState message="This deck could not be loaded." />}
      {deck === null && !failed && <Skeleton label="Loading deck" rows={3} />}
    </>
  );
}
