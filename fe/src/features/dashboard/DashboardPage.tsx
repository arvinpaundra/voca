import { PageHeader } from "../../components/PageHeader";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import { session } from "../../lib/appSession";
import { ActivitySection } from "./ActivitySection";
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

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pt-8 pb-24">
      {learner.kind === "loading" && <Skeleton label="Loading dashboard" rows={4} />}
      {learner.kind === "failed" && <ErrorState message="Couldn't load your dashboard." />}

      {learner.kind === "loaded" && (
        <>
          <PageHeader
            title={learner.value.name.trim().split(/\s+/)[0] ?? learner.value.name}
            description={greetingFor(new Date().getHours())}
          />

          <div className="grid gap-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
              <TodaySection state={notifications} stats={stats} learner={learner.value} />
              <StreakSection state={stats} />
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[65%_1fr]">
              <DecksSection state={decks} />

              <div className="grid min-w-0 gap-6">
                <ActivitySection learner={learner.value} />
                <ProgressSection state={stats} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
