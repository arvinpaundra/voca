import type { LearnerStats } from "@voca/contract";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import { StatStrip } from "../../components/StatStrip";
import type { Loadable } from "./useLoadable";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;

const percent = (ratio: number | null | undefined) =>
  ratio === null || ratio === undefined ? "—" : `${Math.round(ratio * 100)}%`;

const weekdayOf = (date: string) => WEEKDAY_LETTERS[new Date(`${date}T00:00:00Z`).getUTCDay()];

export function ProgressSection({ state }: { state: Loadable<LearnerStats> }) {
  if (state.kind === "loading") {
    return <Skeleton label="Loading progress" rows={3} />;
  }

  if (state.kind === "failed") {
    return <ErrorState message="Couldn't load progress." />;
  }

  const stats = state.value;
  const { maturity, trueRetention, calibration, reviewsPerDay, forecast } = stats;
  const cardCount = maturity.new + maturity.learning + maturity.mature;
  const segments = [
    { label: "New", count: maturity.new, className: "bg-m-new" },
    { label: "Learning", count: maturity.learning, className: "bg-m-learning" },
    { label: "Mature", count: maturity.mature, className: "bg-m-mature" },
  ];
  const busiest = Math.max(1, ...reviewsPerDay.map((day) => day.count));

  return (
    <section aria-label="Progress" className="grid min-w-0 gap-6 rounded-card border border-stone-200 bg-white p-6">
      <h2 className="text-xs font-semibold tracking-[0.06em] text-stone-500 uppercase">Progress</h2>

      <StatStrip
        stats={[
          { label: "Mastered", value: String(maturity.mature) },
          { label: "True retention", value: percent(trueRetention) },
          {
            label: "Predicted vs. actual",
            value: calibration === null ? "—" : `${percent(calibration.predicted)} / ${percent(calibration.actual)}`,
          },
        ]}
      />

      <div className="grid gap-2">
        <div className="flex h-2 overflow-hidden rounded-[2px] bg-stone-200" role="img" aria-label={`${cardCount} cards`}>
          {segments.map((segment) =>
            segment.count > 0 ? (
              <span key={segment.label} className={segment.className} style={{ flexGrow: segment.count }} />
            ) : null,
          )}
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
          {segments.map((segment) => (
            <span key={segment.label} className="tabular-nums">
              {segment.label} {segment.count}
            </span>
          ))}
        </p>
      </div>

      <div className="grid gap-2">
        <p className="text-xs text-stone-500">Reviews, last 30 days</p>
        <svg
          className="block h-16 w-full fill-stone-400"
          viewBox="0 0 300 60"
          preserveAspectRatio="none"
          role="img"
          aria-label="Reviews per day, last 30 days"
        >
          {reviewsPerDay.map((day, i) => {
            const barHeight = (day.count / busiest) * 56;
            return (
              <rect key={day.date} x={i * 10 + 1} y={60 - barHeight} width={8} height={barHeight} rx={1}>
                <title>{`${day.count} reviews · ${day.date}`}</title>
              </rect>
            );
          })}
        </svg>
      </div>

      <div className="grid gap-2">
        <p className="text-xs text-stone-500">Next 7 days</p>
        <ul className="grid grid-cols-7 gap-1.5 text-center">
          {forecast.map((day) => (
            <li key={day.date} className="grid gap-0.5">
              <span className="text-xs text-stone-500">{weekdayOf(day.date)}</span>
              <span className="font-mono text-sm tabular-nums text-stone-900">{day.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
