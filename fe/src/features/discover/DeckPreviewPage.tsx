import { useEffect, useState } from "react";
import { DateTime, Option, Result, Schema } from "effect";
import { DeckSlug, type PublicDeckDetail } from "@voca/contract";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { PageHeader } from "../../components/PageHeader";
import { Skeleton } from "../../components/Skeleton";
import { StatStrip } from "../../components/StatStrip";
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
    new Date(DateTime.toEpochMillis(publishedAt)),
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
        const notFound =
          typeof failure === "object" && failure !== null && "_tag" in failure && failure._tag === "NotFound";

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
    <div className="w-full py-6 sm:py-8">
      <Button variant="ghost" size="sm" href="/app/discover" className="-ml-3 mb-6">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Discover
      </Button>

      {state.kind === "loading" && <Skeleton label="Loading deck" rows={4} />}

      {state.kind === "failed" && <ErrorState message="This deck could not be loaded." />}

      {state.kind === "missing" && (
        <EmptyState
          title="Deck not found"
          action={
            <Button variant="secondary" size="sm" href="/app/discover">
              Back to Discover
            </Button>
          }
        />
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
  const languages = `${deck.termLang} → ${deck.meaningLang}`;

  return (
    <div>
      <PageHeader
        title={deck.title}
        description={`${deck.owner.name} · ${languages} · Published ${publishedLabel(deck.publishedAt)}`}
        actions={
          <Button variant="primary" busy={forking} onClick={onFork}>
            {forking ? "Forking…" : "Fork"}
          </Button>
        }
      />

      <div className="grid gap-8">
        {deck.description !== "" && (
          <p dir="auto" className="whitespace-pre-line text-sm text-stone-700">
            {deck.description}
          </p>
        )}

        <StatStrip
          stats={[
            { label: "Words", value: String(deck.wordCount) },
            { label: "Forks", value: String(deck.forkCount) },
          ]}
        />

        {forkError !== null && (
          <p role="alert" className="text-sm text-red-600">
            {forkError}
          </p>
        )}

        <section className="grid gap-3">
        <h2 className="text-xs font-semibold tracking-[0.06em] text-stone-500 uppercase">Preview</h2>

        <div className="overflow-hidden rounded-card border border-stone-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Preview words</caption>

            <thead>
              <tr className="h-8 border-b border-stone-200 text-[11px] font-semibold tracking-[0.06em] text-stone-500 uppercase">
                <th scope="col" className="px-4 text-left font-semibold">
                  Term
                </th>
                <th scope="col" className="px-4 text-left font-semibold">
                  Meaning
                </th>
              </tr>
            </thead>

            <tbody>
              {deck.preview.map((word) => (
                <tr key={word.slug} className="border-b border-stone-100 last:border-b-0">
                  <td className="px-4 py-3" lang={deck.termLang}>
                    <Term term={word.term} reading={word.reading ?? ""} lang={deck.termLang} dir="auto" size="md" />
                  </td>
                  <td className="px-4 py-3 text-stone-700" lang={deck.meaningLang} dir="auto">
                    {word.meaning}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

          {deck.wordCount > deck.preview.length && (
            <p className="text-center text-xs text-stone-400">
              Showing {deck.preview.length} of {deck.wordCount} words
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
