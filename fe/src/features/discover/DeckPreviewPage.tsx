import { useEffect, useState } from "react";
import { Option, Result, Schema } from "effect";
import { DeckSlug, type PublicDeckDetail } from "@voca/contract";
import { ArrowLeft, GitFork } from "lucide-react";
import { Avatar } from "../../components/Avatar";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { PageHeader } from "../../components/PageHeader";
import { Skeleton } from "../../components/Skeleton";
import { session } from "../../lib/appSession";
import { forkDeck, forkMessage } from "./fork";
import { PreviewList } from "./PreviewList";
import { forkLabel } from "./PublicDeckRows";

type PreviewState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "failed" }
  | { kind: "loaded"; deck: PublicDeckDetail };

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
    <div className="content" style={{ maxWidth: 820 }}>
      <a className="back" href="/app/discover">
        <ArrowLeft className="i" aria-hidden="true" />
        Discover
      </a>

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
