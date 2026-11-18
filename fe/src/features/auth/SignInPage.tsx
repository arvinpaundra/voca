import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "../../components/Button";
import { Spinner } from "../../components/Spinner";
import { beginSignIn } from "../../lib/auth";
import { Logo } from "../../components/Logo";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

export function SignInPage() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const configured = clientId != null && clientId !== "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-stone-900 p-12 lg:flex">
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime opacity-10 blur-[120px]"
          aria-hidden="true"
        />
        <div className="relative z-10">
          <Logo tone="dark" />
        </div>
        <div className="relative z-10 flex max-w-sm flex-col gap-6">
          <p className="font-mono text-xs tracking-widest text-lime uppercase">Spaced repetition for every language</p>
          <h2 className="font-montserrat text-4xl leading-tight font-medium tracking-tight text-white xl:text-5xl">
            Build the habit. Remember for life.
          </h2>
          <p className="text-base leading-relaxed text-stone-400">
            Voca schedules your reviews so you never forget a word you've already learned.
          </p>
        </div>
        <p className="relative z-10 text-xs text-stone-500">Private by default. Your decks are yours.</p>
      </div>

      <header className="flex shrink-0 items-center justify-between bg-stone-900 px-6 py-5 lg:hidden">
        <Logo tone="dark" />
        <span className="hidden text-xs text-stone-400 sm:block">Spaced repetition for every language</span>
      </header>

      <div className="flex flex-1 items-center justify-center bg-neutral-100 px-6 py-12">
        <div className="flex w-full max-w-md flex-col gap-8 rounded-card border border-stone-200 bg-white p-8 shadow-[0_8px_32px_rgba(0,0,0,0.08)] lg:p-10">
          <Logo />
          <div className="flex flex-col gap-1">
            <h1 className="font-montserrat text-2xl font-semibold tracking-tight text-stone-900">Welcome back.</h1>
            <p className="text-sm text-stone-500">
              Use your Google account. Your Voca account is created the first time you sign in, so there
              is no password to remember.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <button
              type="button"
              disabled={!configured || busy}
              onClick={handleSignIn}
              className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-card border border-stone-200 bg-white px-5 py-3.5 text-sm font-medium text-stone-800 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all duration-150 select-none hover:border-stone-300 hover:bg-stone-50 hover:shadow-[0_2px_8px_rgba(0,0,0,0.12)] focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70"
            >
              {busy ? <Spinner size="sm" label="Redirecting" /> : <GoogleIcon />}
              <span>{busy ? "Redirecting…" : "Sign in with Google"}</span>
            </button>
            {!configured && (
              <p className="text-sm text-stone-600">
                Sign-in is not configured yet. Set <code>VITE_GOOGLE_CLIENT_ID</code> to enable it.
              </p>
            )}
            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-card border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
              >
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                {error}
              </div>
            )}
          </div>

          <div className="border-t border-stone-200 pt-6">
            <Button variant="ghost" href="/">
              Back to home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
