import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Option, Schema } from "effect";
import { DeckSlug, type PublicDeckDetail } from "@voca/contract";
import { ArrowLeft, GitFork } from "lucide-react";
import { Avatar } from "../../components/Avatar";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { PageHeader } from "../../components/PageHeader";
import { Skeleton } from "../../components/Skeleton";
import { publicDeckQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { forkDeck, forkMessage } from "./fork";
import { PreviewList } from "./PreviewList";
import { forkLabel } from "./PublicDeckRows";

export function DeckPreviewPage({ deckSlug }: { deckSlug: string }) {
  // A URL segment is a plain string; a malformed slug is answered as a missing deck without calling the API.
  const parsed = Schema.decodeUnknownOption(DeckSlug)(deckSlug);

  return (
    <div className="content" style={{ maxWidth: 820 }}>
      <a className="back" href="/app/discover">
        <ArrowLeft className="i" aria-hidden="true" />
        Discover
      </a>

      {Option.isSome(parsed) ? <LoadedPreview key={parsed.value} deckSlug={parsed.value} /> : <DeckNotFound />}
    </div>
  );
}

function LoadedPreview({ deckSlug }: { deckSlug: DeckSlug }) {
  const preview = useQuery(publicDeckQuery(deckSlug), queryClient);
  const [forking, setForking] = useState(false);
  const [forkError, setForkError] = useState<string | null>(null);

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

  if (preview.isPending) return <Skeleton label="Loading deck" rows={4} />;

  if (preview.isError) {
    const failure: unknown = preview.error;
    const notFound =
      typeof failure === "object" && failure !== null && "_tag" in failure && failure._tag === "NotFound";

    return notFound ? <DeckNotFound /> : <ErrorState message="This deck could not be loaded." />;
  }

  return (
    <PreviewBody
      deck={preview.data}
      forking={forking}
      forkError={forkError}
      onFork={() => void fork(preview.data.slug)}
    />
  );
}

function DeckNotFound() {
  return (
    <EmptyState
      title="Deck not found"
      action={
        <Button variant="secondary" size="sm" href="/app/discover">
          Back to Discover
        </Button>
      }
    />
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
    <>
      <PageHeader
        title={deck.title}
        meta={
          <>
            <span className="author">
              <Avatar name={deck.owner.name} src={deck.owner.avatarUrl} />
              {deck.owner.name}
            </span>
            <span className="dot"></span>
            <Badge variant="outline" lang>
              {`${deck.termLang} → ${deck.meaningLang}`}
            </Badge>
            <span>{`${deck.wordCount} words`}</span>
            <span className="dot"></span>
            <span>{forkLabel(deck.forkCount)}</span>
          </>
        }
        actions={
          <Button variant="primary" busy={forking} onClick={onFork}>
            <GitFork className="i" aria-hidden="true" />
            {forking ? "Forking…" : "Fork deck"}
          </Button>
        }
      />

      {forkError !== null && <ErrorState message={forkError} />}

      {deck.description !== "" && (
        <p dir="auto" style={{ color: "var(--ink-2)", maxWidth: 640, whiteSpace: "pre-line" }}>
          {deck.description}
        </p>
      )}

      <PreviewList words={deck.preview} total={deck.wordCount} termLang={deck.termLang} meaningLang={deck.meaningLang} />
    </>
  );
}
