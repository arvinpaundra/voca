import type { CSSProperties } from "react";
import type { DeckStats } from "@voca/contract";
import { weekdayLetter } from "../dashboard/dashboardModel";

// The retention ring and the maturity bar share one row; the bar takes the spare width and wraps below when narrow.
const RETENTION_ROW: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 };

export function DeckProgress({ stats }: { stats: DeckStats }) {
  const { maturity, forecast, trueRetention } = stats;

  const retention = trueRetention === null ? null : Math.round(trueRetention * 100);
  const retentionText = retention === null ? "—" : `${retention}%`;

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

      <div className="wide maturity" style={RETENTION_ROW}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            className="ring-meter"
            aria-hidden="true"
            style={{ "--p": retention ?? 0 } as CSSProperties}
            data-label={retentionText}
          />
          <div style={{ display: "grid", gap: 2 }}>
            <span className="eyebrow">True retention · 30 days</span>
            <b aria-label="True retention" className="sr">
              {retentionText}
            </b>
          </div>
        </div>

        <div style={{ flex: "1 1 200px", display: "grid", gap: 10, minWidth: 0 }}>
          <div
            className="mbar"
            role="img"
            aria-label={`New ${maturity.new}, learning ${maturity.learning}, mature ${maturity.mature}`}
          >
            <span style={{ flex: maturity.new }}></span>
            <span style={{ flex: maturity.learning }}></span>
            <span style={{ flex: maturity.mature }}></span>
          </div>
          <div className="legend">
            <span>
              <i style={{ background: "var(--m-new)" }}></i>New <b>{maturity.new}</b>
            </span>
            <span>
              <i style={{ background: "var(--m-learning)" }}></i>Learning <b>{maturity.learning}</b>
            </span>
            <span>
              <i style={{ background: "var(--m-mature)" }}></i>Mature <b>{maturity.mature}</b>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
