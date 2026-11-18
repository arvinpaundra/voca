import type { DeckStats } from "@voca/contract";
import { StatStrip } from "../../components/StatStrip";

export function DeckProgress({ stats }: { stats: DeckStats }) {
  const { maturity } = stats;
  const words = maturity.new + maturity.learning + maturity.mature;
  const retention = stats.trueRetention === null ? "—" : `${Math.round(stats.trueRetention * 100)}%`;

  return (
    <section aria-label="Deck progress" className="grid gap-3">
      <StatStrip
        stats={[
          { label: "Words", value: String(words) },
          { label: "Due today", value: String(stats.dueToday) },
          { label: "Overdue", value: String(stats.overdue) },
          { label: "Retention", value: retention },
        ]}
      />

      <div
        role="img"
        aria-label={`New ${maturity.new}, learning ${maturity.learning}, mature ${maturity.mature}`}
        className="flex h-1.5 overflow-hidden rounded-full bg-stone-100"
      >
        <span className="bg-m-new" style={{ flexGrow: maturity.new }} />
        <span className="bg-m-learning" style={{ flexGrow: maturity.learning }} />
        <span className="bg-m-mature" style={{ flexGrow: maturity.mature }} />
      </div>
    </section>
  );
}
