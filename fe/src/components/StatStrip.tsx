import { cx } from "./cx";

export type Stat = { label: string; value: string; highlight?: boolean };

export function StatStrip({ stats, className }: { stats: ReadonlyArray<Stat>; className?: string | undefined }) {
  return (
    <dl className={cx("kpis", className)}>
      {stats.map((stat) => (
        <div key={stat.label} className={cx("kpi", stat.highlight === true && "hl")}>
          <dt className="l">{stat.label}</dt>
          <dd className="v">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}
