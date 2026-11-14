import { useEffect, useState } from "react";
import type { Learner } from "@voca/contract";
import { Button } from "../../components/Button";
import { Container } from "../../components/Container";
import { Wordmark } from "../../components/Wordmark";
import { session, tokenStore } from "../../lib/appSession";
import { loadCurrentLearner } from "../../lib/signIn";
import { LandingPage } from "../landing/LandingPage";
import styles from "./home.module.css";

export function HomePage() {
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

  return learner === null ? <LandingPage /> : <SignedInHome learner={learner} />;
}

function SignedInHome({ learner }: { learner: Learner }) {
  return (
    <div className={styles.page}>
      <Container>
        <div className={styles.inner}>
          <Wordmark />
          {learner.avatarUrl !== null && (
            <img className={styles.avatar} src={learner.avatarUrl} alt="" />
          )}
          <h1 className={styles.title}>Signed in as {learner.name}</h1>
          <p className={styles.body}>{learner.email}</p>
          <Button variant="ghost" onClick={() => void session.signOut()}>
            Sign out
          </Button>
        </div>
      </Container>
    </div>
  );
}
