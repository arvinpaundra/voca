import { useEffect, useState } from "react";
import { DateTime, Option, Result, Schema } from "effect";
import { DeckSlug, type PublicDeckDetail } from "@voca/contract";
import { Button } from "../../components/Button";
import { Container } from "../../components/Container";
import { Term } from "../../components/Term";
import { Wordmark } from "../../components/Wordmark";
import { session } from "../../lib/appSession";
import { forkDeck, forkMessage } from "./fork";
import styles from "./discover.module.css";

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
    <div className={styles.page}>
      <Container>
        <div className={styles.inner}>
          <Wordmark />

          {state.kind === "loading" && <p className={styles.note}>Loading…</p>}
          {state.kind === "failed" && <p className={styles.error} role="alert">This deck could not be loaded.</p>}

          {state.kind === "missing" && (
            <div className={styles.empty}>
              <p className={styles.note}>Deck not found</p>
              <a className={styles.back} href="/app/discover">
                ← Discover
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
      </Container>
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
    <section className={styles.preview}>
      <header className={styles.previewHeader}>
        <a className={styles.back} href="/app/discover">
          ← Discover
        </a>
        <h1 className={styles.title} dir="auto">
          {deck.title}
        </h1>
        <p className={styles.owner}>
          {deck.owner.avatarUrl !== null && <img className={styles.avatar} src={deck.owner.avatarUrl} alt="" />}
          <span dir="auto">{deck.owner.name}</span>
        </p>
        <p className={styles.note}>
          {deck.termLang} → {deck.meaningLang}
        </p>
        {deck.description !== "" && (
          <p className={styles.body} dir="auto">
            {deck.description}
          </p>
        )}
        <p className={styles.note}>
          {deck.wordCount} words · {deck.forkCount} forks · Published {publishedLabel(deck.publishedAt)}
        </p>
        <div className={styles.actions}>
          <Button variant="accent" disabled={forking} onClick={onFork}>
            {forking ? "Forking…" : "Fork deck"}
          </Button>
        </div>
        {forkError !== null && <p className={styles.error} role="alert">{forkError}</p>}
      </header>

      <ul className={styles.words}>
        {deck.preview.map((word) => (
          <li key={word.slug} className={styles.word}>
            <span className={styles.term}>
              <Term term={word.term} reading={word.reading ?? ""} lang={deck.termLang} dir="auto" />
            </span>
            <span className={styles.meaning} lang={deck.meaningLang} dir="auto">
              {word.meaning}
            </span>
          </li>
        ))}
      </ul>

      {deck.wordCount > deck.preview.length && (
        <p className={styles.note}>
          Showing {deck.preview.length} of {deck.wordCount} words
        </p>
      )}
    </section>
  );
}
