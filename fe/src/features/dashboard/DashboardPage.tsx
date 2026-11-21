import { DateTime } from "effect";
import { ErrorState } from "../../components/ErrorState";
import { PageHeader } from "../../components/PageHeader";
import { Skeleton } from "../../components/Skeleton";
import { session } from "../../lib/appSession";
import { ActivitySection } from "./ActivitySection";
import { BacklogHint } from "./BacklogHint";
import { localHour, longDate, studyDate } from "./dashboardModel";
import { DecksSection } from "./DecksSection";
import { ProgressSection } from "./ProgressSection";
import { StreakSection } from "./StreakSection";
import { TodaySection } from "./TodaySection";
import { useLoadable } from "./useLoadable";

const greetingFor = (hour: number) => {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

export function DashboardPage() {
  // Every section loads its own data: a failed call shows its own message and the rest of the page still renders.
  const learner = useLoadable(() => session.call((client) => client.me.get()), []);
  const stats = useLoadable(() => session.call((client) => client.insight.learnerStats()), []);
  const notifications = useLoadable(() => session.call((client) => client.insight.notifications()), []);
  const decks = useLoadable(() => session.call((client) => client.library.listDecks()), []);

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
