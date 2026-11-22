import { useEffect } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { DateTime } from "effect";
import type { DeckSummary } from "@voca/contract";
import { ErrorState } from "../../components/ErrorState";
import { PageHeader } from "../../components/PageHeader";
import { Skeleton } from "../../components/Skeleton";
import { mergePages } from "../../lib/paging";
import { dueDecksQuery, learnerStatsQuery, meQuery, notificationsQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { ActivitySection } from "./ActivitySection";
import { BacklogHint } from "./BacklogHint";
import { backlogThreshold } from "./backlog";
import { loadableOf, localHour, longDate, studyDate, type Loadable } from "./dashboardModel";
import { DecksSection } from "./DecksSection";
import { ProgressSection } from "./ProgressSection";
import { StreakSection } from "./StreakSection";
import { TodaySection } from "./TodaySection";

const greetingFor = (hour: number) => {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

export function DashboardPage() {
  // Every section reads its own query: a failed query shows its own message and the rest of the page still renders.
  const learner = loadableOf(useQuery(meQuery(), queryClient));
  const stats = loadableOf(useQuery(learnerStatsQuery(), queryClient));
  const notifications = loadableOf(useQuery(notificationsQuery(), queryClient));
  const deckPages = useInfiniteQuery(dueDecksQuery(), queryClient);
  const loadedDecks = mergePages(deckPages.data?.pages ?? []);
  const lastDeck: DeckSummary | undefined = loadedDecks.at(-1);

  // The backlog hint covers every deck, so the reading goes on while the last deck read is still behind.
  const stillBehind =
    learner.kind === "loaded" &&
    lastDeck !== undefined &&
    lastDeck.dueCount > backlogThreshold(learner.value.settings.defaultSessionSize);

  useEffect(() => {
    if (stillBehind && deckPages.hasNextPage && !deckPages.isFetchingNextPage) void deckPages.fetchNextPage();
  }, [stillBehind, deckPages.hasNextPage, deckPages.isFetchingNextPage, deckPages.fetchNextPage]);

  const decks: Loadable<readonly DeckSummary[]> = deckPages.isError
    ? { kind: "failed" }
    : deckPages.isSuccess
      ? { kind: "loaded", value: loadedDecks }
      : { kind: "loading" };

  if (learner.kind === "loading") return <Skeleton label="Loading dashboard" rows={4} />;
  if (learner.kind === "failed") return <ErrorState message="Couldn't load your dashboard." />;

  const now = DateTime.nowUnsafe();
  const { timezone, dayStartHour } = learner.value.settings;
  const firstName = learner.value.name.trim().split(/\s+/)[0] ?? learner.value.name;

  return (
    <>
      <PageHeader
        eyebrow={longDate(studyDate(now, timezone, dayStartHour))}
        title={`${greetingFor(localHour(now, timezone))}, ${firstName}`}
      />

      <div className="dash">
        <div className="dash-main">
          {decks.kind === "loaded" && (
            <BacklogHint decks={decks.value} sessionSize={learner.value.settings.defaultSessionSize} />
          )}
          <TodaySection state={notifications} stats={stats} learner={learner.value} />
          <DecksSection state={decks} />
        </div>

        <div className="dash-side">
          <StreakSection state={stats} />
          <ActivitySection learner={learner.value} />
          <ProgressSection state={stats} />
        </div>
      </div>
    </>
  );
}
