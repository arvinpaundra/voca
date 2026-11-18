import type { DeckStats } from "@voca/contract";

export function DeckProgress({ stats }: { stats: DeckStats }) {
  const { maturity } = stats;

  return (
    <section className="deck-stats-strip" aria-label="Deck progress">
      <div className="kpi">
        <dd className="v">{stats.dueToday}</dd>
        <dt className="l">due today</dt>
      </div>
      <div className="kpi">
        <dd className="v">{maturity.new}</dd>
        <dt className="l">new</dt>
      </div>
      <div className="kpi">
        <dd className="v">{maturity.learning}</dd>
        <dt className="l">learning</dt>
      </div>
      <div className="kpi">
        <dd className="v">{maturity.mature}</dd>
        <dt className="l">mature</dt>
      </div>

      <div className="wide" aria-label="Due next 7 study days">
        <div className="forecast">
          <div>
            <small>not implemented: LF</small>
            <b>not implemented: LF</b>
          </div>
        </div>
      </div>

      <div className="wide" aria-label="True retention">
        not implemented: LF
      </div>

      <div className="wide maturity">
        <div
          className="mbar"
          role="img"
          aria-label={`New ${maturity.new}, learning ${maturity.learning}, mature ${maturity.mature}`}
        >
          <span style={{ flex: maturity.new }}></span>
          <span style={{ flex: maturity.learning }}></span>
          <span style={{ flex: maturity.mature }}></span>
        </div>
      </div>
    </section>
  );
}
