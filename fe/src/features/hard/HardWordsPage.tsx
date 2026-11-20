import { useEffect, useMemo, useState } from "react";
import { DateTime, Option, Result, Schema } from "effect";
import { Drill, type HardWord, type SessionSize } from "@voca/contract";
import { ArrowRight, Flame } from "lucide-react";
import { Button } from "../../components/Button";
import { useAppData } from "../../components/appData";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { PageHeader } from "../../components/PageHeader";
import { Skeleton } from "../../components/Skeleton";
import { Tabs } from "../../components/Tabs";
import { session } from "../../lib/appSession";
import { failureTag } from "../deck/wordModel";
import { startFailure } from "../study/startFailure";
import { rememberHardStudy } from "../study/returnTo";
import { HardStudySetup } from "./HardStudySetup";
import { HardWordList } from "./HardWordList";
import { hardDrills } from "./hardDrills";

const DEFAULT_SIZE: SessionSize = 10;
const ALL = "all";

type Filter = typeof ALL | Drill;

type LoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "failed" }
  | { readonly kind: "ready"; readonly words: readonly HardWord[] };

const filterFromUrl = (): Filter => {
  const raw = new URLSearchParams(window.location.search).get("drill");

  return Option.getOrElse(Schema.decodeUnknownOption(Drill)(raw), (): Filter => ALL);
};

const setFilterInUrl = (filter: Filter): void => {
  const url = new URL(window.location.href);

  if (filter === ALL) url.searchParams.delete("drill");
  else url.searchParams.set("drill", filter);

  window.history.replaceState(null, "", url);
};

const inFilter = (word: HardWord, filter: Filter): boolean =>
  word.cards.some((card) => card.isHard && (filter === ALL || card.drill === filter));

export function HardWordsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [filter, setFilter] = useState<Filter>(filterFromUrl);
  const [studying, setStudying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = useMemo(() => DateTime.nowUnsafe(), []);
  const { learner, reloadNotifications } = useAppData();
  const defaultSize: SessionSize = learner.kind === "loaded" ? learner.value.settings.defaultSessionSize : DEFAULT_SIZE;

  useEffect(() => {
    let active = true;

    const load = async () => {
      const words: HardWord[] = [];
      let cursor: string | undefined;

      do {
        const result = await session.call((client) =>
          client.study.hardWords({ query: cursor === undefined ? {} : { cursor } }),
        );

        if (!Result.isSuccess(result)) return null;

        words.push(...result.success.items);
        cursor = result.success.nextCursor ?? undefined;
      } while (cursor !== undefined);

      return words;
    };

    void load().then((words) => {
      if (!active) return;
      setState(words === null ? { kind: "failed" } : { kind: "ready", words });
    });

    return () => {
      active = false;
    };
  }, []);

  if (state.kind === "loading") return <Skeleton label="Loading hard words" rows={3} />;
  if (state.kind === "failed") return <ErrorState message="Hard words could not be loaded." />;

  const { words } = state;
  const drills = hardDrills(words);
  const visible = words.filter((word) => inFilter(word, filter));

  const nowMillis = DateTime.toEpochMillis(now);
  const dueToday = words.filter((word) =>
    word.cards.some((card) => card.isHard && DateTime.toEpochMillis(DateTime.makeUnsafe(card.due)) <= nowMillis),
  ).length;

  const choose = (next: Filter) => {
    setFilter(next);
    setFilterInUrl(next);
  };

  const unmark = async (word: HardWord) => {
    const cards = word.cards.filter((card) => card.isHard && (filter === ALL || card.drill === filter));

    const results = await Promise.all(
      cards.map((card) =>
        session.call((client) => client.study.unmarkHard({ params: { wordSlug: word.slug, drill: card.drill } })),
      ),
    );

    if (!results.every(Result.isSuccess)) {
      setError("Could not unmark that word. Try again.");
      return;
    }

    setError(null);

    const unmarked = new Set(cards.map((card) => card.drill));

    setState({
      kind: "ready",
      words: words.map((item) =>
        item.slug === word.slug
          ? { ...item, cards: item.cards.map((card) => (unmarked.has(card.drill) ? { ...card, isHard: false } : card)) }
          : item,
      ),
    });

    // Unmarking changes the queue, so the shell's hard count has to be fetched again.
    reloadNotifications();
  };

  const start = async (chosen: readonly Drill[], size: SessionSize) => {
    const [first, ...rest] = chosen;
    if (first === undefined) return;

    setBusy(true);
    setError(null);

    if (size !== defaultSize) {
      // The size is a preference for next time; a failed save must not block the session.
      void session.call((client) => client.me.updateSettings({ payload: { defaultSessionSize: size } }));
    }

    const result = await session.call((client) =>
      client.study.start({ payload: { scope: { kind: "hard" }, drills: [first, ...rest], size, mode: "easy" } }),
    );

    setBusy(false);

    if (Result.isSuccess(result)) {
      rememberHardStudy();
      window.location.assign("/app/study");
      return;
    }

    setError(startFailure(failureTag(result.failure)));
  };

  if (studying) {
    return (
      <HardStudySetup
        drills={drills}
        defaultSize={defaultSize}
        busy={busy}
        error={error}
        onStart={(chosen, size) => void start(chosen, size)}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Hard words"
        meta={
          <>
            <span>{`${words.length} ${words.length === 1 ? "word" : "words"}`}</span>
            <span className="dot" />
            <span>{`${dueToday} due today`}</span>
          </>
        }
        actions={
          <Button
            variant="primary"
            disabled={drills.length === 0}
            onClick={() => {
              setError(null);
              setStudying(true);
            }}
          >
            Study hard words
            <ArrowRight className="i" aria-hidden="true" />
          </Button>
        }
      />

      {words.length === 0 ? (
        <EmptyState
          icon={<Flame className="i i-lg" aria-hidden="true" />}
          title="No hard words"
          body="Mark a word hard from its page or after a session. Words you keep forgetting are suggested."
        />
      ) : (
        <>
          <Tabs
            label="Drill"
            value={filter}
            onChange={choose}
            tabs={[{ value: ALL, label: "All" }, ...drills.map((entry) => ({ value: entry.drill, label: entry.label }))]}
          />

          {error !== null && (
            <p role="alert" style={{ color: "var(--bad)", fontSize: 13 }}>
              {error}
            </p>
          )}

          <HardWordList words={visible} now={now} onUnmark={(word) => void unmark(word)} />
        </>
      )}
    </>
  );
}
