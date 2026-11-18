import type { DeckStats } from "@voca/contract";
import { weekdayLetter } from "../dashboard/dashboardModel";

export function DeckProgress({ stats }: { stats: DeckStats }) {
  const { maturity, forecast, trueRetention } = stats;

  const retention = trueRetention === null ? null : Math.round(trueRetention * 100);

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

      <div className="wide">
        <span className="eyebrow">Due · next 7 days</span>
        <div aria-label="Due next 7 study days">
          <div className="forecast">
            {forecast.map((day) => (
              <div key={day.date}>
                <small>{weekdayLetter(day.date)}</small>
                <b>{day.count}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="wide">
        <span className="eyebrow">True retention · 30 days</span>
        <b aria-label="True retention">{retention === null ? "—" : `${retention}%`}</b>
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
