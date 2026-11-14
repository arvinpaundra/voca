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
import { Button } from "../../components/Button";
import { Container } from "../../components/Container";
import { Term } from "../../components/Term";
import { Wordmark } from "../../components/Wordmark";
import { session } from "../../lib/appSession";
import { advance } from "./queue";
import { studyReturnHref } from "./returnTo";
import styles from "./study.module.css";

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

  if (state.kind === "loading") return <Shell><p className={styles.note}>Loading…</p></Shell>;

  if (state.kind === "failed") {
    return <Shell><p className={styles.error} role="alert">Could not load your session.</p></Shell>;
  }

  if (state.kind === "none") {
    return (
      <Shell>
        <p className={styles.note}>No study session is running.</p>
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

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.page}>
      <Container>
        <div className={styles.inner}>
          <Wordmark />
          {children}
        </div>
      </Container>
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

  if (finished) {
    return (
      <section className={styles.setup}>
        <h1 className={styles.title} aria-live="polite">Session complete</h1>
        <p className={styles.progress}>{`${cleared} / ${studySession.size} cleared`}</p>
        <Button variant="primary" href={studyReturnHref()}>Back to deck</Button>
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
    if (feedback === null) return styles.option;
    if (wordSlug === feedback.result.correctWordSlug) return `${styles.option} ${styles.optionRight}`;
    if (wordSlug === feedback.chosen) return `${styles.option} ${styles.optionWrong}`;
    return styles.option;
  };

  return (
    <section className={styles.study}>
      <p className={styles.progress}>{`${cleared} / ${studySession.size} cleared`}</p>
      <p className={styles.drill} dir="auto">{head.drillLabel}</p>

      <p className={styles.prompt}>
        {promptIsTerm ? (
          <Term
            term={head.prompt.text}
            reading={head.prompt.ruby ?? ""}
            lang={studySession.termLang}
            size="lg"
          />
        ) : (
          <span dir="auto">{head.prompt.text}</span>
        )}
      </p>

      <ul className={styles.options}>
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
                className={answerIsTerm ? styles.optionTerm : undefined}
              >
                {option.text}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className={styles.cue} aria-live="polite">{cue}</p>

      {error !== null && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.actions}>
        {answered && <Button variant="primary" onClick={next}>Next</Button>}
        <Button variant="ghost" disabled={busy} onClick={() => void endSession()}>
          End session
        </Button>
      </div>
    </section>
  );
}
