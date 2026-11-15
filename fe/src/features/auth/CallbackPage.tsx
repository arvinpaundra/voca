import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { Button } from "../../components/Button";
import { Spinner } from "../../components/Spinner";
import { session } from "../../lib/appSession";
import { consumePkce, redirectUri } from "../../lib/auth";
import { completeSignIn, type SignInFailure } from "../../lib/signIn";
import { BrandMark } from "../landing/BrandMark";

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-100 px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-card border border-stone-200 bg-white p-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.08)] lg:p-10">
        <BrandMark />
        {failure === null ? (
          <div className="flex flex-col items-center gap-4">
            <Spinner size="lg" label="Signing you in" />
            <p className="text-sm text-stone-500">Signing you in…</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="font-montserrat text-2xl font-semibold tracking-tight text-stone-900">Sign-in failed</h1>
              <p role="alert" className="flex items-center justify-center gap-2 text-sm text-red-600">
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                {failureMessage(failure)}
              </p>
            </div>
            <Button variant="accent" href="/login">
              Try again
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
