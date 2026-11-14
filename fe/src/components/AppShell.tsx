import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { Learner } from "@voca/contract";
import { session, tokenStore } from "../lib/appSession";
import { loadCurrentLearner } from "../lib/signIn";
import { Button } from "./Button";
import { Wordmark } from "./Wordmark";
import styles from "./appShell.module.css";

export function AppShell({ children }: { children: ReactNode }) {
  const [learner, setLearner] = useState<Learner | null>(null);

  useEffect(() => {
    let active = true;

    loadCurrentLearner(session, tokenStore).then((found) => {
      if (active) setLearner(found);
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
          <Link
            to="/app"
            activeOptions={{ exact: true }}
            className={styles.link}
            activeProps={{ className: styles.active }}
          >
            Dashboard
          </Link>
          <Link to="/app/decks" className={styles.link} activeProps={{ className: styles.active }}>
            Decks
          </Link>
          <Link to="/app/discover" className={styles.link} activeProps={{ className: styles.active }}>
            Discover
          </Link>
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
