import { useMemo, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { DateTime, Option, Result, Schema } from "effect";
import { Drill, drillLabel, type HardWord, type HardWordsSummary, type SessionSize } from "@voca/contract";
import { ArrowRight, Flame } from "lucide-react";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadMore } from "../../components/LoadMore";
import { PageHeader } from "../../components/PageHeader";
import { SearchInput } from "../../components/SearchInput";
import { Skeleton } from "../../components/Skeleton";
import { Tabs } from "../../components/Tabs";
import { session } from "../../lib/appSession";
import { mergePages } from "../../lib/paging";
import { hardWordsQuery, meQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { failureTag } from "../deck/wordModel";
import { startFailure } from "../study/startFailure";
import { rememberHardStudy } from "../study/returnTo";
import { HardStudySetup } from "./HardStudySetup";
import { HardWordList } from "./HardWordList";
import { hardDrills, type HardDrill } from "./hardDrills";
import { useDebouncedSearch } from "../../lib/useDebouncedSearch";

const DEFAULT_SIZE: SessionSize = 10;
const ALL = "all";

type Filter = typeof ALL | Drill;

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

// A write changes what the cache holds, so the whole cache refetches once one lands.
const refreshOnSuccess = (result: Result.Result<unknown, unknown>): void => {
  if (Result.isSuccess(result)) void queryClient.invalidateQueries();
};

// The tabs of the summary: one per drill with hard words, in the contract's order.
const drillTabs = (summary: HardWordsSummary): HardDrill[] =>
  summary.drills.map((entry) => ({
    drill: entry.drill,
    label: drillLabel(entry.termLang, entry.drill),
    count: entry.count,
  }));

export function HardWordsPage() {
  const [filter, setFilter] = useState<Filter>(filterFromUrl);
  // The box shows what is typed; the list is searched once the typing pauses, or at once on Enter.
  const { input: searchInput, setInput: setSearchInput, search, submit: submitSearch } = useDebouncedSearch();
  const [studying, setStudying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A drill tab or a new search is a new query, so its list starts from the first page; the old list stays up until
  // the new one arrives.
  const hard = useInfiniteQuery(
    {
      ...hardWordsQuery({
        ...(filter === ALL ? {} : { drill: filter }),
        ...(search === "" ? {} : { q: search }),
      }),
      placeholderData: keepPreviousData,
    },
    queryClient,
  );
  const learner = useQuery(meQuery(), queryClient);

  const now = useMemo(() => DateTime.nowUnsafe(), []);

  const defaultSize = learner.data?.settings.defaultSessionSize ?? DEFAULT_SIZE;

  if (hard.isError) return <ErrorState message="Hard words could not be loaded." />;

  if (!hard.isSuccess) return <Skeleton label="Loading hard words" rows={3} />;

  const words = mergePages(hard.data.pages);
  // The header and the tabs cover every hard word, so they come from the summary of the first page. The summary is
  // optional while the server rolls out; without it, the loaded words are counted.
  const summary = hard.data.pages[0]?.summary ?? null;
  const drills = summary === null ? hardDrills(words) : drillTabs(summary);
  const total = summary?.total ?? words.length;
  const visible = words.filter((word) => inFilter(word, filter));

  const nowMillis = DateTime.toEpochMillis(now);
  const dueToday =
    summary?.dueToday ??
    words.filter((word) =>
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
    queryClient.invalidateQueries();
  };

  const start = async (chosen: readonly Drill[], size: SessionSize) => {
    const [first, ...rest] = chosen;
    if (first === undefined) return;

    setBusy(true);
    setError(null);

    if (size !== defaultSize) {
      // The size is a preference for next time; a failed save must not block the session.
      void session
        .call((client) => client.me.updateSettings({ payload: { defaultSessionSize: size } }))
        .then(refreshOnSuccess);
    }

    const result = await session.call((client) =>
      client.study.start({ payload: { scope: { kind: "hard" }, drills: [first, ...rest], size, mode: "easy" } }),
    );

    setBusy(false);
    refreshOnSuccess(result);

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
            <span>{`${total} ${total === 1 ? "word" : "words"}`}</span>
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

      {total === 0 ? (
        <EmptyState
          icon={<Flame className="i i-lg" aria-hidden="true" />}
          title="No hard words"
          body="Mark a word hard from its page or after a session. Words you keep forgetting are suggested."
        />
      ) : (
        <>
          <div className="grid gap-3">
            <div className="toolbar">
              <SearchInput
                label="Search hard words"
                placeholder="Search hard words"
                value={searchInput}
                onChange={setSearchInput}
                onSubmit={submitSearch}
              />
            </div>

            <Tabs
              label="Drill"
              value={filter}
              onChange={choose}
              tabs={[{ value: ALL, label: "All" }, ...drills.map((entry) => ({ value: entry.drill, label: entry.label }))]}
            />
          </div>

          {error !== null && (
            <p role="alert" style={{ color: "var(--bad)", fontSize: 13 }}>
              {error}
            </p>
          )}

          <HardWordList words={visible} now={now} onUnmark={(word) => void unmark(word)} />

          <LoadMore
            hasNextPage={hard.hasNextPage && !hard.isPlaceholderData}
            isFetchingNextPage={hard.isFetchingNextPage}
            onLoadMore={() => void hard.fetchNextPage()}
          />
        </>
      )}
    </>
  );
}
