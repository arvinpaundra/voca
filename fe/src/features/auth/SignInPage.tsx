import { useEffect, useState } from "react";
import { ArrowLeft, Check, CircleAlert } from "lucide-react";
import { Spinner } from "../../components/Spinner";
import { takeDeletedNotice } from "../../lib/account";
import { beginSignIn } from "../../lib/auth";
import { Logo } from "../../components/Logo";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

export function SignInPage() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const configured = clientId != null && clientId !== "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    if (takeDeletedNotice()) setDeleted(true);
  }, []);

  // A page restored from the back-forward cache keeps its state, so the busy flag from the
  // redirect would still show "Redirecting…" when the learner comes back from Google.
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      setBusy(false);
      setError(null);
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

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
    <div className="auth" style={{ minHeight: "100vh" }}>
      <div className="auth-art">
        <div style={{ position: "relative", zIndex: 1 }}>
          <Logo tone="dark" />
        </div>

        <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 16 }}>
          <span className="eyebrow" style={{ color: "var(--lime)" }}>
            Spaced repetition · any language
          </span>
          <h2>Build the habit. Remember for life.</h2>
          <p style={{ color: "var(--dark-muted)", maxWidth: 340 }}>
            Each word comes back just before you’d forget it.
          </p>
        </div>

        <span style={{ position: "relative", zIndex: 1, fontSize: 12, color: "#78716c" }}>
          Private by default. Your decks are yours.
        </span>
      </div>

      <div className="auth-form">
        <div className="auth-card">
          <div style={{ display: "grid", gap: 6 }}>
            <h1 className="h1">Welcome back</h1>
            <p className="sub">Use your Google account. New here? Your account is created on first sign-in.</p>
          </div>

          {deleted && (
            <div role="status" className="alert alert-info">
              <Check className="i" aria-hidden="true" />
              <span>Your account has been deleted.</span>
            </div>
          )}

          <button type="button" className="gbtn" disabled={!configured || busy} onClick={handleSignIn}>
            {busy ? <Spinner size="sm" label="Redirecting" /> : <GoogleIcon />}
            {busy ? "Redirecting…" : "Continue with Google"}
          </button>

          {!configured && (
            <p className="sub">
              Sign-in is not configured yet. Set <code>VITE_GOOGLE_CLIENT_ID</code> to enable it.
            </p>
          )}

          {error !== null && (
            <div role="alert" className="alert alert-bad">
              <CircleAlert className="i" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <a className="back" href="/">
            <ArrowLeft className="i" aria-hidden="true" />
            Back to home
          </a>
        </div>
      </div>
    </div>
  );
}
