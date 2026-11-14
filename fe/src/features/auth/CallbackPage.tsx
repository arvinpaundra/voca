import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "../../components/Button";
import { Container } from "../../components/Container";
import { session } from "../../lib/appSession";
import { consumePkce, redirectUri } from "../../lib/auth";
import { completeSignIn, type SignInFailure } from "../../lib/signIn";
import styles from "./auth.module.css";

function failureMessage(reason: SignInFailure): string {
  return reason === "google-error"
    ? "You cancelled sign-in at Google."
    : "Could not complete sign-in. Please try again.";
}

export function CallbackPage() {
  const navigate = useNavigate();
  const [failure, setFailure] = useState<SignInFailure | null>(null);
  // StrictMode runs effects twice, and the PKCE verifier is removed on its first read: only the first run may sign in.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    completeSignIn({
      search: window.location.search,
      pkce: consumePkce,
      session,
      redirectUri: redirectUri(),
      timezone,
    }).then((outcome) => {
      if (outcome.kind === "signed-in") {
        void navigate({ to: "/", replace: true });
        return;
      }
      setFailure(outcome.reason);
    });
  }, [navigate]);

  return (
    <div className={styles.page}>
      <Container>
        <div className={styles.inner}>
          {failure === null ? (
            <p className={styles.body}>Signing you in…</p>
          ) : (
            <>
              <h1 className={styles.title}>Sign-in failed</h1>
              <p className={styles.body}>{failureMessage(failure)}</p>
              <Button variant="primary" href="/login">
                Try again
              </Button>
            </>
          )}
        </div>
      </Container>
    </div>
  );
}
