import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Result } from "effect";
import {
  DRILLS,
  MAX_LATENCY_MS,
  drillLabel,
  readingLang,
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
import { IconButton } from "../../components/IconButton";
import { session } from "../../lib/appSession";
import { activeSessionQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { AnswerOptions } from "./AnswerOptions";
import { SessionTally } from "./SessionTally";
import { Verdict } from "./Verdict";
import { SessionSummary } from "./SessionSummary";
import { advance } from "./queue";
import { segments, tally } from "./progress";
import { isHardStudy, studyReturnHref } from "./returnTo";
import { answerLang, promptLang } from "./scriptLang";
import { QuestionPrompt } from "./QuestionPrompt";
import { requestedSize, shortSessionNotice } from "./shortSession";
import { SessionNotice } from "./SessionNotice";
import { SessionWords, type SessionWordItem } from "./SessionWords";
import { SfxToggle } from "./SfxToggle";
import { sfx, unlock } from "./sfx";

// Marks and the tally count only first attempts, so a retry never adds a mark. The first word still to come is `cur`.
const markClasses = (size: number, firstAttempts: readonly boolean[]): string[] => {
  let currentTaken = false;

  return segments(size, firstAttempts).map((segment) => {
    if (segment === "right") return "r";
    if (segment === "wrong") return "w";
    if (currentTaken) return "";

    currentTaken = true;

    return "cur";
  });
};

// The row for the question's word: the term and the other side of the pair, from the prompt and the right option.
const wordItem = (question: Question, termLang: string, result: AnswerResult): SessionWordItem => {
  const promptIsTerm = DRILLS[question.drill].prompt === "term";
  const correctText = question.options.find((option) => option.wordSlug === result.correctWordSlug)?.text ?? "";

  return {
    wordSlug: question.wordSlug,
    drill: question.drill,
    term: promptIsTerm ? question.prompt.text : correctText,
    meaning: promptIsTerm ? correctText : question.prompt.text,
    lang: termLang,
    correct: result.correct,
    leech: result.leech,
    // A hard session only asks hard cards.
    hard: isHardStudy()
  };
};

// One row per word: the first attempt stands.
const withWord = (items: readonly SessionWordItem[], item: SessionWordItem): readonly SessionWordItem[] =>
  items.some((existing) => existing.wordSlug === item.wordSlug) ? items : [...items, item];

// A write refreshes the whole cache, so the live session refetches after every answer. Once a session is open,
// the flow keeps it: a refetch that finds nothing running (the answer just finished the session) must not
// take the summary off the screen.
export function StudyPage() {
  const active = useQuery(activeSessionQuery(), queryClient);
  const [opened, setOpened] = useState<Session | null>(null);

  useEffect(() => {
    if (active.data) setOpened(active.data);
  }, [active.data]);

  const studySession = opened ?? active.data ?? null;

  if (studySession !== null) {
    return (
      <Shell>
        <StudyFlow key={studySession.slug} studySession={studySession} />
      </Shell>
    );
  }

  if (active.isError) {
    return (
      <Shell>
        <ErrorState message="Could not load your session." />
      </Shell>
    );
  }

  if (active.isPending) {
    return (
      <Shell>
        <Skeleton label="Loading study session" rows={3} />
      </Shell>
    );
  }

  return (
    <Shell>
      <EmptyState
        title="No study session is running."
        action={<Button variant="secondary" href="/app">Back to dashboard</Button>}
      />
    </Shell>
  );
}

// A write changes what the cache holds, so the whole cache refetches once one lands.
const refreshOnSuccess = (result: Result.Result<unknown, unknown>): void => {
  if (Result.isSuccess(result)) void queryClient.invalidateQueries();
};

// The study session has no sidebar, so the page supplies the full-screen frame itself.
function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="main">
      <div className="content">{children}</div>
    </main>
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
  const [words, setWords] = useState<readonly SessionWordItem[]>([]);
  const [notice] = useState(() =>
    shortSessionNotice(requestedSize(window.localStorage), studySession.size)
  );

  const startedAt = useRef(0);
  const head = queue[0];

  // Latency runs from when this question's options render, so reading the prompt counts.
  useEffect(() => {
    startedAt.current = performance.now();
  }, [head?.position, head?.attempt]);

  // Only a session that has not started yet opens with a sound: a resumed one stays quiet.
  useEffect(() => {
    if (!finished && cleared === 0 && firstAttempts.length === 0) sfx.start();
  }, []);

  const choose = async (question: Question, wordSlug: WordSlug) => {
    if (feedback !== null || busy) return;

    unlock();
    sfx.select();

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
    refreshOnSuccess(result);

    if (Result.isSuccess(result)) {
      setFeedback({ chosen: wordSlug, result: result.success });

      if (result.success.correct) sfx.correct();
      else sfx.wrong();

      if (result.success.correct) setCleared((count) => count + 1);
      if (question.attempt === 1) {
        setFirstAttempts((previous) => [...previous, result.success.correct]);
        setWords((previous) => withWord(previous, wordItem(question, studySession.termLang, result.success)));
      }
      return;
    }

    setError("Could not record that answer. Try again.");
  };

  const next = () => {
    if (feedback === null) return;

    const remaining = advance(queue, feedback.result.retry);

    setQueue(remaining);
    setFeedback(null);

    if (feedback.result.retry) sfx.retry();

    if (feedback.result.completed || remaining.length === 0) {
      setFinished(true);
      sfx.complete();
    }
  };

  const endSession = async () => {
    setBusy(true);
    setError(null);

    const result = await session.call((client) =>
      client.study.abandon({ params: { sessionSlug: studySession.slug } })
    );

    setBusy(false);
    refreshOnSuccess(result);

    if (Result.isSuccess(result)) {
      window.location.assign(studyReturnHref());
      return;
    }

    setError("Could not end the session. Try again.");
  };

  const toggleHard = async (item: SessionWordItem) => {
    const params = { wordSlug: item.wordSlug as WordSlug, drill: item.drill };

    const result = await session.call((client) =>
      item.hard ? client.study.unmarkHard({ params }) : client.study.markHard({ params })
    );

    refreshOnSuccess(result);

    if (Result.isSuccess(result)) {
      setWords((previous) =>
        previous.map((word) => (word.wordSlug === item.wordSlug ? { ...word, hard: !item.hard } : word))
      );
      return;
    }

    setError("Could not change that word. Try again.");
  };

  const summary = tally(firstAttempts);

  // A session with no question left and no answer to show has nothing to study: say so and offer a way back.
  if (!finished && head === undefined && words.length === 0) {
    return (
      <EmptyState
        title="Nothing to study right now."
        body="No word is due in this session and no new word is left for today."
        action={<Button variant="secondary" href={studyReturnHref()}>Back</Button>}
      />
    );
  }

  if (finished || head === undefined) {
    return (
      <div className="mx-auto grid w-full max-w-[640px] gap-4">
        <SessionSummary firstAttempts={firstAttempts} backHref={studyReturnHref()} tight={words.length > 0} />

        {error !== null && <p className="text-center" style={{ color: "var(--bad)" }} role="alert">{error}</p>}

        {words.length > 0 && (
          <SessionWords
            items={words}
            drillLabel={[...new Set(words.map((word) => drillLabel(studySession.termLang, word.drill)))].join(" · ")}
            onToggleHard={(item) => void toggleHard(item)}
          />
        )}
      </div>
    );
  }

  const promptIsTerm = DRILLS[head.drill].prompt !== "meaning";

  const correctText =
    head.options.find((option) => option.wordSlug === feedback?.result.correctWordSlug)?.text ?? "";
  const verdictTerm = promptIsTerm ? head.prompt.text : correctText;
  const verdictAnswer = promptIsTerm ? correctText : head.prompt.text;

  // The verdict's term is the prompt when the prompt is a term or a reading, else the correct option: each text
  // takes the language of the field it came from, so a reading is never tagged with the term's language.
  const verdictTermLang = promptIsTerm
    ? promptLang(head.drill, studySession.termLang)
    : answerLang(head.drill, studySession.termLang);
  const verdictAnswerLang = promptIsTerm
    ? answerLang(head.drill, studySession.termLang)
    : promptLang(head.drill, studySession.termLang);

  return (
    <div className="study">
      <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
        <div className="study-top">
          <IconButton label="Close session" href={studyReturnHref()} className="rounded-full bg-[#e7e5e4] text-[var(--ink)]">
            <X className="i" aria-hidden="true" />
          </IconButton>

          <div className="strip" aria-hidden="true">
            {markClasses(studySession.size, firstAttempts).map((mark, index) => (
              <i key={index} className={mark} />
            ))}
          </div>

          <span className="num muted" style={{ fontSize: 13 }}>{`${cleared} / ${studySession.size}`}</span>

          <SfxToggle />
        </div>

        <SessionNotice notice={notice} />

        <section className="prompt">
          <QuestionPrompt question={head} termLang={studySession.termLang} />

          <AnswerOptions
            options={head.options}
            correctSlug={feedback?.result.correctWordSlug ?? null}
            chosenSlug={feedback?.chosen ?? null}
            disabled={busy}
            lang={answerLang(head.drill, studySession.termLang)}
            onChoose={(wordSlug) => {
              const option = head.options.find((candidate) => candidate.wordSlug === wordSlug);
              if (option !== undefined) void choose(head, option.wordSlug);
            }}
          />
        </section>

        {feedback !== null && (
          <Verdict
            correct={feedback.result.correct}
            term={verdictTerm}
            answer={verdictAnswer}
            reading={feedback.result.reading ?? null}
            readingLang={readingLang(studySession.termLang)}
            termLang={verdictTermLang}
            answerLang={verdictAnswerLang}
            onNext={next}
          />
        )}

        {error !== null && <p className="text-center" style={{ color: "var(--bad)" }} role="alert">{error}</p>}

        <div style={{ display: "flex", justifyContent: "center" }}>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void endSession()}>
            End session
          </Button>
        </div>
      </div>

      <SessionTally
        cleared={cleared}
        size={studySession.size}
        right={summary.right}
        wrong={summary.wrong}
      />
    </div>
  );
}
