import type { LearnerStats } from "@voca/contract";
import type { Loadable } from "./useLoadable";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;

const percent = (ratio: number | null | undefined) =>
  ratio === null || ratio === undefined ? "—" : `${Math.round(ratio * 100)}%`;

const weekdayOf = (date: string) => WEEKDAY_LETTERS[new Date(`${date}T00:00:00Z`).getUTCDay()];

export function ProgressSection({ state }: { state: Loadable<LearnerStats> }) {
  if (state.kind === "loading") return <p className="text-sm text-stone-500">Loading progress…</p>;
  if (state.kind === "failed") return <p className="text-sm text-stone-500">Couldn't load progress.</p>;

  const stats = state.value;
  const { maturity, trueRetention, calibration, reviewsPerDay, forecast } = stats;
  const cardCount = maturity.new + maturity.learning + maturity.mature;
  const segments = [
    { label: "New", count: maturity.new, className: "bg-lime/50" },
    { label: "Learning", count: maturity.learning, className: "bg-blue-400" },
    { label: "Mature", count: maturity.mature, className: "bg-lime" },
  ];
  const busiest = Math.max(1, ...reviewsPerDay.map((day) => day.count));
  const retentionDegrees = Math.min(100, Math.max(0, (trueRetention ?? 0) * 100)) * 3.6;

  return (
    <section aria-label="Progress" className="grid min-w-0 gap-5 rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-montserrat text-5xl leading-none font-bold text-stone-900">{maturity.mature}</p>
          <p className="mt-1 text-sm text-stone-500">Words mastered</p>
        </div>

        <div
          className="relative size-14 shrink-0 rounded-full"
          role="img"
          aria-label={`True retention ${percent(trueRetention)}`}
          style={{ background: `conic-gradient(var(--color-lime) ${retentionDegrees}deg, #e7e5e4 0deg)` }}
        >
          <div className="absolute inset-2 flex items-center justify-center rounded-full bg-white">
            <span className="text-xs font-bold text-stone-900">{percent(trueRetention)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <div
          className="flex h-3 overflow-hidden rounded-full bg-stone-200"
          role="img"
          aria-label={`${cardCount} cards`}
        >
          {segments.map((segment) =>
            segment.count > 0 ? (
              <span key={segment.label} className={segment.className} style={{ flexGrow: segment.count }} />
            ) : null,
          )}
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
          {segments.map((segment) => (
            <span key={segment.label}>
              {segment.label} {segment.count}
            </span>
          ))}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-stone-500">Predicted vs. actual recall</dt>
          <dd className="mt-0.5 text-lg text-stone-900">
            {calibration === null ? "—" : `${percent(calibration.predicted)} vs. ${percent(calibration.actual)}`}
          </dd>
        </div>
      </dl>

      <div>
        <p className="text-xs text-stone-500">Reviews, last 30 days</p>
        <svg
          className="mt-1 block h-16 w-full fill-lime"
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

      <div>
        <p className="text-xs text-stone-500">Next 7 days</p>
        <ul className="mt-2 grid grid-cols-7 gap-1.5 text-center text-sm">
          {forecast.map((day) => (
            <li key={day.date} className="grid gap-0.5">
              <span className="text-xs text-stone-500">{weekdayOf(day.date)}</span>
              <span className="text-stone-900">{day.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
