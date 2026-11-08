import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { Container } from "../../components/Container";
import { consumePkce, redirectUri, setAccessToken, REFRESH_TOKEN_KEY } from "../../lib/auth";
import styles from "./auth.module.css";

type SignedIn = { accessToken: string; refreshToken: string };

export function CallbackPage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const pkce = consumePkce();

    if (!code || !pkce || state !== pkce.state) {
      setFailed(true);
      return;
    }

    // shortcut: plain fetch until the Effect HttpApiClient is wired in.
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        codeVerifier: pkce.verifier,
        redirectUri: redirectUri(),
        timezone,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as SignedIn;
        setAccessToken(body.accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, body.refreshToken);
        // shortcut: no authenticated home yet; `/` is the only other route.
        window.location.assign("/");
      })
      .catch(() => setFailed(true));
  }, []);

  return (
    <div className={styles.page}>
      <Container>
        <div className={styles.inner}>
          {failed ? (
            <>
              <h1 className={styles.title}>Sign-in failed</h1>
              <p className={styles.body}>
                Could not complete sign-in. The backend may not be running yet.
              </p>
              <Button variant="primary" href="/login">
                Try again
              </Button>
            </>
          ) : (
            <p className={styles.body}>Signing you in…</p>
          )}
        </div>
      </Container>
    </div>
  );
}
