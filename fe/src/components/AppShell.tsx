import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Result } from "effect";
import type { DeckSummary, Learner } from "@voca/contract";
import { session, tokenStore } from "../lib/appSession";
import { loadCurrentLearner } from "../lib/signIn";
import { Button } from "./Button";
import { Wordmark } from "./Wordmark";
import styles from "./appShell.module.css";

type DeckListState =
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | { readonly kind: "loaded"; readonly decks: readonly DeckSummary[] };

export function AppShell({ children }: { children: ReactNode }) {
  const [learner, setLearner] = useState<Learner | null>(null);
  const [decks, setDecks] = useState<DeckListState>({ kind: "loading" });

  useEffect(() => {
    let active = true;

    loadCurrentLearner(session, tokenStore).then((found) => {
      if (active) setLearner(found);
    });
    session.call((client) => client.library.listDecks()).then((result) => {
      if (!active) return;

      setDecks(
        Result.isSuccess(result)
          ? { kind: "loaded", decks: result.success }
          : { kind: "failed" }
      );
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Wordmark />

        <nav className={styles.nav} aria-label="Main">
          <Link to="/dashboard" className={styles.link} activeProps={{ className: styles.active }}>
            Dashboard
          </Link>
          {/* The study route is registered by a separate change; drop this cast once it is. */}
          <Link
            to={"/study" as "/dashboard"}
            className={styles.link}
            activeProps={{ className: styles.active }}
          >
            Study
          </Link>

          <h2 className={styles.heading}>Decks</h2>
          <DeckLinks state={decks} />
        </nav>

        {learner !== null && (
          <div className={styles.footer}>
            {learner.avatarUrl !== null && (
              <img className={styles.avatar} src={learner.avatarUrl} alt="" />
            )}
            <span className={styles.name}>{learner.name}</span>
            <Button variant="ghost" onClick={() => void session.signOut()}>
              Sign out
            </Button>
          </div>
        )}
      </aside>

      <div className={styles.content}>{children}</div>
    </div>
  );
}

function DeckLinks({ state }: { state: DeckListState }) {
  if (state.kind === "loading") return null;
  if (state.kind === "failed") return <p className={styles.error}>Couldn't load decks</p>;

  return (
    <>
      {state.decks.map((deck) => (
        <Link
          key={deck.slug}
          to="/decks/$deckSlug"
          params={{ deckSlug: deck.slug }}
          className={`${styles.link} ${styles.deck}`}
          activeProps={{ className: `${styles.link} ${styles.deck} ${styles.active}` }}
        >
          {deck.title}
        </Link>
      ))}
    </>
  );
}
