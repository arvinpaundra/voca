import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";
import { Button } from "../../components/Button";
import { Spinner } from "../../components/Spinner";
import { session } from "../../lib/appSession";
import { consumePkce, redirectUri } from "../../lib/auth";
import { completeSignIn, type SignInFailure } from "../../lib/signIn";
import { Logo } from "../../components/Logo";

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
        void navigate({ to: "/app", replace: true });
        return;
      }
      setFailure(outcome.reason);
    });
  }, [navigate]);

  return (
    <div className="auth-form" style={{ minHeight: "100vh" }}>
      <div className="auth-card">
        <Logo />

        {failure === null ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Spinner size="lg" label="Signing you in" />
            <p className="sub">Signing you in…</p>
          </div>
        ) : (
          <>
            <h1 className="h1">Sign-in failed</h1>

            <div role="alert" className="alert alert-bad">
              <CircleAlert className="i" aria-hidden="true" />
              <span>{failureMessage(failure)}</span>
            </div>

            <Button variant="primary" href="/login">
              Try again
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
