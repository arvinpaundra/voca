import { cx } from "./cx";

export type Stat = { label: string; value: string };

export function StatStrip({ stats, className }: { stats: ReadonlyArray<Stat>; className?: string | undefined }) {
  return (
    <dl
      className={cx(
        "grid auto-cols-fr grid-flow-col divide-x divide-stone-200 overflow-hidden rounded-card border border-stone-200 bg-white",
        className,
      )}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="p-4">
          <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-stone-500">{stat.label}</dt>
          <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-stone-900">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
