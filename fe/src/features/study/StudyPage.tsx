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
import { X } from "lucide-react";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import { Term } from "../../components/Term";
import { cx } from "../../components/cx";
import { session } from "../../lib/appSession";
import { AnswerOptions } from "./AnswerOptions";
import { SessionSummary } from "./SessionSummary";
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
        <Skeleton label="Loading study session" rows={3} />
      </Shell>
    );
  }

  if (state.kind === "failed") {
    return (
      <Shell>
        <ErrorState message="Could not load your session." />
      </Shell>
    );
  }

  if (state.kind === "none") {
    return (
      <Shell>
        <EmptyState
          title="No study session is running."
          action={<Button variant="secondary" href="/app">Back to dashboard</Button>}
        />
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

  if (finished) {
    return <SessionSummary firstAttempts={firstAttempts} backHref={studyReturnHref()} />;
  }

  if (head === undefined) return null;

  const answerIsTerm = DRILLS[head.drill].answer !== "meaning";
  const promptIsTerm = DRILLS[head.drill].prompt !== "meaning";

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <header className="flex items-center gap-3">
          <a
            href={studyReturnHref()}
            aria-label="Close session"
            title="Close session"
            className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-stone-600 hover:bg-stone-200/70 hover:text-stone-900"
          >
            <X className="size-4" aria-hidden="true" />
          </a>
          <p className="min-w-0 shrink truncate text-sm font-medium text-stone-600" dir="auto">
            {head.drillLabel}
          </p>
          <SegmentStrip size={studySession.size} firstAttempts={firstAttempts} />
          <p className="shrink-0 font-mono text-xs tabular-nums text-stone-500">{`${cleared} / ${studySession.size}`}</p>
        </header>

        <section className="flex flex-col items-center gap-8 rounded-card border border-stone-200 bg-white px-6 py-12">
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

          <AnswerOptions
            options={head.options}
            correctSlug={feedback?.result.correctWordSlug ?? null}
            chosenSlug={feedback?.chosen ?? null}
            disabled={busy}
            lang={answerIsTerm ? studySession.termLang : undefined}
            onChoose={(wordSlug) => {
              const option = head.options.find((candidate) => candidate.wordSlug === wordSlug);
              if (option !== undefined) void choose(head, option.wordSlug);
            }}
          />
        </section>

        {error !== null && <p className="text-center text-sm text-red-600" role="alert">{error}</p>}

        <div className="flex flex-wrap items-center justify-center gap-3">
          {feedback !== null && <Button variant="primary" onClick={next}>Next</Button>}
          <Button variant="ghost" disabled={busy} onClick={() => void endSession()}>
            End session
          </Button>
        </div>
      </div>

      <aside
        aria-label="This session"
        className="flex w-full shrink-0 flex-col gap-6 rounded-card border border-stone-200 bg-white p-6 lg:sticky lg:top-6 lg:w-72"
      >
        <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-stone-500">This session</h2>
        <div className="flex flex-col gap-1">
          <p className="font-mono text-3xl font-semibold tabular-nums text-stone-900">
            {`${cleared} / ${studySession.size}`}
          </p>
          <p className="text-xs text-stone-500">words cleared</p>
        </div>
        <dl className="flex flex-col divide-y divide-stone-200">
          {[
            { label: "Right", value: String(summary.right) },
            { label: "Wrong", value: String(summary.wrong) },
            {
              label: "Accuracy",
              value: summary.accuracy === null ? "—" : `${Math.round(summary.accuracy * 100)}%`,
            },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center justify-between py-2">
              <dt className="text-sm text-stone-600">{stat.label}</dt>
              <dd className="font-mono text-sm font-semibold tabular-nums text-stone-900">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  );
}
