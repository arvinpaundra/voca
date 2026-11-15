import { useEffect, useState } from "react";
import { DateTime, Option, Result, Schema } from "effect";
import { DeckSlug, type PublicDeckDetail } from "@voca/contract";
import { ArrowLeft } from "lucide-react";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { Term } from "../../components/Term";
import { session } from "../../lib/appSession";
import { forkDeck, forkMessage } from "./fork";

type PreviewState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "failed" }
  | { kind: "loaded"; deck: PublicDeckDetail };

const publishedLabel = (publishedAt: DateTime.Utc) =>
  new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(DateTime.toEpochMillis(publishedAt))
  );

export function DeckPreviewPage({ deckSlug }: { deckSlug: string }) {
  const [state, setState] = useState<PreviewState>({ kind: "loading" });
  const [forking, setForking] = useState(false);
  const [forkError, setForkError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });

    // A URL segment is a plain string; a malformed slug is answered as a missing deck without calling the API.
    const parsed = Schema.decodeUnknownOption(DeckSlug)(deckSlug);
    if (Option.isNone(parsed)) {
      setState({ kind: "missing" });
      return;
    }

    session.call((client) => client.community.get({ params: { deckSlug: parsed.value } })).then((result) => {
      if (!active) return;

      if (Result.isSuccess(result)) {
        setState({ kind: "loaded", deck: result.success });
      } else {
        const failure = result.failure;
        const notFound = typeof failure === "object" && failure !== null && "_tag" in failure && failure._tag === "NotFound";

        setState({ kind: notFound ? "missing" : "failed" });
      }
    });

    return () => {
      active = false;
    };
  }, [deckSlug]);

  const fork = async (slug: DeckSlug) => {
    setForking(true);
    setForkError(null);

    const outcome = await forkDeck(slug);

    if (outcome.kind === "forked") {
      window.location.assign(`/app/decks/${outcome.slug}`);
      return;
    }

    setForking(false);
    setForkError(forkMessage(outcome));
  };

  return (
    <div className="space-y-6">
      {state.kind === "loading" && <p className="text-sm text-stone-500">Loading…</p>}
      {state.kind === "failed" && (
        <p role="alert" className="text-sm text-red-600">
          This deck could not be loaded.
        </p>
      )}

      {state.kind === "missing" && (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <p className="text-lg font-semibold text-stone-900">Deck not found</p>
          <a href="/app/discover" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Discover
          </a>
        </div>
      )}

      {state.kind === "loaded" && (
        <PreviewBody
          deck={state.deck}
          forking={forking}
          forkError={forkError}
          onFork={() => void fork(state.deck.slug)}
        />
      )}
    </div>
  );
}

type PreviewBodyProps = {
  deck: PublicDeckDetail;
  forking: boolean;
  forkError: string | null;
  onFork: () => void;
};

function PreviewBody({ deck, forking, forkError, onFork }: PreviewBodyProps) {
  return (
    <section className="space-y-6">
      <a href="/app/discover" className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Discover
      </a>

      <header className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 dir="auto" className="min-w-0 flex-1 break-words font-montserrat text-2xl font-semibold leading-snug text-stone-900">
            {deck.title}
          </h1>
          <Button variant="primary" disabled={forking} onClick={onFork}>
            {forking ? "Forking…" : "Fork deck"}
          </Button>
        </div>

        <div className="flex min-w-0 items-center gap-2 text-sm text-stone-500">
          <Avatar name={deck.owner.name} src={deck.owner.avatarUrl} size="sm" />
          <span dir="auto" className="truncate">
            {deck.owner.name}
          </span>
        </div>

        <p className="text-sm text-stone-500">
          {deck.termLang} → {deck.meaningLang}
        </p>

        {deck.description !== "" && (
          <p dir="auto" className="whitespace-pre-line text-stone-700">
            {deck.description}
          </p>
        )}

        <p className="text-sm text-stone-400">
          {deck.wordCount} words · {deck.forkCount} forks · Published {publishedLabel(deck.publishedAt)}
        </p>

        {forkError !== null && (
          <p role="alert" className="text-sm text-red-600">
            {forkError}
          </p>
        )}
      </header>

      <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
        {deck.preview.map((word) => (
          <li key={word.slug} className="grid grid-cols-[minmax(120px,1fr)_2fr] items-baseline gap-4 px-5 py-3">
            <span>
              <Term term={word.term} reading={word.reading ?? ""} lang={deck.termLang} dir="auto" />
            </span>
            <span className="text-stone-700" lang={deck.meaningLang} dir="auto">
              {word.meaning}
            </span>
          </li>
        ))}
      </ul>

      {deck.wordCount > deck.preview.length && (
        <p className="text-center text-xs text-stone-400">
          Showing {deck.preview.length} of {deck.wordCount} words
        </p>
      )}
    </section>
  );
}
