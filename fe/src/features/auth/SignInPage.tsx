import { useState } from "react";
import { Button } from "../../components/Button";
import { Container } from "../../components/Container";
import { Wordmark } from "../../components/Wordmark";
import { beginSignIn } from "../../lib/auth";
import styles from "./auth.module.css";

export function SignInPage() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const configured = clientId != null && clientId !== "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    if (!configured || busy) return;
    setBusy(true);
    setError(null);
    try {
      await beginSignIn(clientId);
    } catch {
      setBusy(false);
      setError("Could not start sign-in. Please try again.");
    }
  }

  return (
    <div className={styles.page}>
      <Container>
        <div className={styles.inner}>
          <Wordmark />
          <h1 className={styles.title}>Sign in</h1>
          <p className={styles.body}>
            Use your Google account. Your Voca account is created the first time you sign in, so
            there is no password to remember.
          </p>
          <Button variant="primary" onClick={handleSignIn} disabled={!configured || busy}>
            {busy ? "Redirecting…" : "Sign in with Google"}
          </Button>
          {!configured && (
            <p className={styles.note}>
              Sign-in is not configured yet. Set <code>VITE_GOOGLE_CLIENT_ID</code> to enable it.
            </p>
          )}
          {error && <p className={styles.note}>{error}</p>}
          <Button variant="ghost" href="/">
            Back to home
          </Button>
        </div>
      </Container>
    </div>
  );
}
