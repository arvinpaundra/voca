import { useEffect, useRef, useState, type ReactNode } from "react";
import { Result } from "effect";
import {
  DRILLS,
  MAX_LATENCY_MS,
  type AnswerResult,
  type Question,
  type Session,
  type WordSlug
} from "@voca/contract";
import { X, Trophy } from "lucide-react";
import { Button } from "../../components/Button";
import { Term } from "../../components/Term";
import { cx } from "../../components/cx";
import { session } from "../../lib/appSession";
import { advance } from "./queue";
import { segments, tally, type Segment } from "./progress";
import { studyReturnHref } from "./returnTo";

const SEGMENT_CLASS: Record<Segment, string> = {
  right: "bg-lime",
  wrong: "bg-red-500",
  pending: "bg-stone-200",
};

// Segments and the tally count only first attempts, so a retry never adds a segment.
const SegmentStrip = ({ size, firstAttempts }: { size: number; firstAttempts: readonly boolean[] }) => (
  <div className="flex h-1.5 min-w-0 flex-1 gap-1 overflow-hidden" aria-hidden="true">
    {segments(size, firstAttempts).map((segment, index) => (
      <span key={index} className={cx("min-w-[3px] flex-1 rounded-full", SEGMENT_CLASS[segment])} />
    ))}
  </div>
);

type LoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | { readonly kind: "none" }
  | { readonly kind: "ready"; readonly studySession: Session };

export function StudyPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let active = true;

    session.call((client) => client.study.active()).then((result) => {
      if (!active) return;
      if (!Result.isSuccess(result)) setState({ kind: "failed" });
      else if (result.success === null) setState({ kind: "none" });
      else setState({ kind: "ready", studySession: result.success });
    });

    return () => {
      active = false;
    };
  }, []);

  if (state.kind === "loading") {
    return (
      <Shell>
        <p className="text-sm text-stone-500">Loading…</p>
      </Shell>
    );
  }

  if (state.kind === "failed") {
    return (
      <Shell>
        <p className="text-sm text-red-600" role="alert">Could not load your session.</p>
      </Shell>
    );
  }

  if (state.kind === "none") {
    return (
      <Shell>
        <p className="text-sm text-stone-500">No study session is running.</p>
        <Button variant="ghost" href="/app">Back to dashboard</Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <StudyFlow key={state.studySession.slug} studySession={state.studySession} />
    </Shell>
  );
}

// The study session has no sidebar, so the page supplies the full-screen frame itself.
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-100 px-4 py-6 lg:px-8 lg:py-10">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">{children}</div>
    </div>
  );
}

type Feedback = {
  readonly chosen: WordSlug;
  readonly result: AnswerResult;
};

function StudyFlow({ studySession }: { studySession: Session }) {
  const [queue, setQueue] = useState<readonly Question[]>(studySession.questions);
  const [cleared, setCleared] = useState(studySession.cleared);
  const [firstAttempts, setFirstAttempts] = useState<readonly boolean[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [finished, setFinished] = useState(studySession.status !== "active");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startedAt = useRef(0);
  const head = queue[0];

  // Latency runs from when this question's options render, so reading the prompt counts.
  useEffect(() => {
    startedAt.current = performance.now();
  }, [head?.position, head?.attempt]);

  const choose = async (question: Question, wordSlug: WordSlug) => {
    if (feedback !== null || busy) return;

    const elapsed = Math.round(performance.now() - startedAt.current);
    const latencyMs = Math.min(Math.max(0, elapsed), MAX_LATENCY_MS);

    setBusy(true);
    setError(null);

    const result = await session.call((client) =>
      client.study.answer({
        params: { sessionSlug: studySession.slug },
        payload: { position: question.position, chosenWordSlug: wordSlug, latencyMs }
      })
    );

    setBusy(false);

    if (Result.isSuccess(result)) {
      setFeedback({ chosen: wordSlug, result: result.success });
      if (result.success.correct) setCleared((count) => count + 1);
      if (question.attempt === 1) setFirstAttempts((previous) => [...previous, result.success.correct]);
      return;
    }

    setError("Could not record that answer. Try again.");
  };

  const next = () => {
    if (feedback === null) return;

    const remaining = advance(queue, feedback.result.retry);

    setQueue(remaining);
    setFeedback(null);

    if (feedback.result.completed || remaining.length === 0) setFinished(true);
  };

  const endSession = async () => {
    setBusy(true);
    setError(null);

    const result = await session.call((client) =>
      client.study.abandon({ params: { sessionSlug: studySession.slug } })
    );

    setBusy(false);

    if (Result.isSuccess(result)) {
      window.location.assign(studyReturnHref());
      return;
    }

    setError("Could not end the session. Try again.");
  };

  const summary = tally(firstAttempts);
  const accuracyLabel = summary.accuracy === null ? "—" : `${Math.round(summary.accuracy * 100)}%`;

  if (finished) {
    return (
      <section className="mx-auto flex w-full max-w-md flex-col items-center gap-5 text-center" aria-live="polite">
        <Trophy className="size-12 text-lime-hover" aria-hidden="true" />
        <h1 className="font-montserrat text-3xl font-bold text-stone-900">Session complete!</h1>
        <div className="flex w-full max-w-xs">
          <SegmentStrip size={studySession.size} firstAttempts={firstAttempts} />
        </div>
        <p className="text-sm text-stone-600">{`${summary.right} right · ${summary.wrong} wrong`}</p>
        {summary.accuracy !== null && (
          <p className="text-sm text-stone-600">{`${accuracyLabel} accuracy`}</p>
        )}
        <div className="flex w-full flex-col-reverse gap-3 pt-2 sm:w-auto sm:flex-row">
          <Button variant="primary" href={studyReturnHref()}>Back to deck</Button>
          <Button variant="ghost" href="/app">Dashboard</Button>
        </div>
      </section>
    );
  }

  if (head === undefined) return null;

  const answered = feedback !== null;
  const answerIsTerm = DRILLS[head.drill].answer !== "meaning";
  const promptIsTerm = DRILLS[head.drill].prompt !== "meaning";
  const correctOption = head.options.find((option) => feedback?.result.correctWordSlug === option.wordSlug);

  const cue = (() => {
    if (feedback === null) return "";
    if (feedback.result.correct) return "Correct.";
    return `Wrong. The answer is ${correctOption?.text ?? ""}.`;
  })();

  const optionClass = (wordSlug: WordSlug) => {
    const base =
      "flex min-h-14 w-full items-center justify-center rounded-2xl border px-5 py-4 text-center text-lg font-medium transition-colors duration-150 disabled:cursor-default";

    if (feedback === null) return cx(base, "border-stone-200 bg-white text-stone-900 hover:border-stone-400 disabled:opacity-60");
    if (wordSlug === feedback.result.correctWordSlug) return cx(base, "border-lime bg-lime text-stone-900");
    if (wordSlug === feedback.chosen) return cx(base, "border-red-500 bg-red-50 text-red-700");
    return cx(base, "border-stone-200 bg-white text-stone-400");
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <header className="flex items-center gap-3 sm:gap-4">
          <a
            href={studyReturnHref()}
            aria-label="Close session"
            title="Close session"
            className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-stone-200/70 text-stone-700 hover:bg-stone-300"
          >
            <X className="size-4" aria-hidden="true" />
          </a>
          <p className="min-w-0 shrink truncate text-sm font-medium text-stone-600" dir="auto">
            {head.drillLabel}
          </p>
          <SegmentStrip size={studySession.size} firstAttempts={firstAttempts} />
          <p className="shrink-0 text-xs text-stone-500">{`${cleared} / ${studySession.size}`}</p>
        </header>

        <section className="flex flex-col items-center gap-8 rounded-card border border-stone-200 bg-white px-6 py-12 shadow-sm">
          <p className="text-center">
            {promptIsTerm ? (
              <Term
                term={head.prompt.text}
                reading={head.prompt.ruby ?? ""}
                lang={studySession.termLang}
                size="lg"
              />
            ) : (
              <span className="text-4xl font-medium text-stone-900" dir="auto">{head.prompt.text}</span>
            )}
          </p>

          <ul className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
            {head.options.map((option) => (
              <li key={option.wordSlug}>
                <button
                  type="button"
                  className={optionClass(option.wordSlug)}
                  disabled={answered || busy}
                  onClick={() => void choose(head, option.wordSlug)}
                >
                  <span
                    dir="auto"
                    lang={answerIsTerm ? studySession.termLang : undefined}
                    className={answerIsTerm ? "font-term" : undefined}
                  >
                    {option.text}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <p className="min-h-5 text-center text-sm font-medium text-stone-700" aria-live="polite">{cue}</p>

        {error !== null && <p className="text-center text-sm text-red-600" role="alert">{error}</p>}

        <div className="flex flex-wrap items-center justify-center gap-3">
          {answered && <Button variant="primary" onClick={next}>Next</Button>}
          <Button variant="ghost" disabled={busy} onClick={() => void endSession()}>
            End session
          </Button>
        </div>
      </div>

      <aside
        aria-label="This session"
        className="flex w-full shrink-0 flex-col gap-5 rounded-card border border-stone-200 bg-white p-6 shadow-sm lg:sticky lg:top-6 lg:w-72"
      >
        <h2 className="text-sm font-semibold text-stone-900">This session</h2>
        <div className="flex flex-col items-center gap-2">
          <p className="font-montserrat text-3xl font-bold text-stone-900">
            {`${cleared} / ${studySession.size}`}
          </p>
          <p className="text-xs text-stone-500">words cleared</p>
        </div>
        <dl className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <dt className="text-stone-600">Right</dt>
            <dd className="font-semibold text-stone-900">{summary.right}</dd>
          </div>
          <div className="flex items-center justify-between text-sm">
            <dt className="text-stone-600">Wrong</dt>
            <dd className="font-semibold text-stone-900">{summary.wrong}</dd>
          </div>
          <div className="flex items-center justify-between text-sm">
            <dt className="text-stone-600">Accuracy</dt>
            <dd className="font-semibold text-stone-900">{accuracyLabel}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
