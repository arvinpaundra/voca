import type { CSSProperties } from "react";
import type { LearnerStats } from "@voca/contract";
import { Card } from "../../components/Card";
import { cx } from "../../components/cx";
import { ErrorState } from "../../components/ErrorState";
import { Skeleton } from "../../components/Skeleton";
import { shortDate, weekdayLetter } from "./dashboardModel";
import type { Loadable } from "./useLoadable";

export function ProgressSection({ state }: { state: Loadable<LearnerStats> }) {
  if (state.kind === "loading") return <Skeleton label="Loading progress" rows={4} />;
  if (state.kind === "failed") return <ErrorState message="Couldn't load your progress." />;

  const { maturity, trueRetention, calibration, reviewsPerDay, forecast } = state.value;
  const retention = trueRetention === null ? undefined : Math.round(trueRetention * 100);
  const peak = Math.max(...reviewsPerDay.map((day) => day.count), 0);
  const peakIndex = peak > 0 ? reviewsPerDay.findIndex((day) => day.count === peak) : -1;
  const first = reviewsPerDay[0];

  return (
    <Card aria-label="Progress">
      <div className="card-head">
        <h2 className="h2">Progress</h2>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div className="kpi">
          <span className="v">{maturity.mature}</span>
          <span className="l">words mastered</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="l muted" style={{ fontSize: 12, textAlign: "right" }}>
            true
            <br />
            retention
          </span>
          <div
            className="ring-meter"
            style={{ "--p": retention ?? 0 } as CSSProperties}
            data-label={retention === undefined ? "—" : `${retention}%`}
          />
        </div>
      </div>

      <div className="maturity">
        <div className="mbar">
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

      <div style={{ display: "grid", gap: 6 }}>
        <span className="eyebrow">Reviews · 30 days</span>
        <div className="bars">
          {reviewsPerDay.map((day, index) => (
            <span
              key={day.date}
              className={cx(index === peakIndex && "hi", index === reviewsPerDay.length - 1 && "is-today")}
              style={{ height: `${peak === 0 ? 0 : Math.round((day.count / peak) * 100)}%` }}
              title={`${day.count} reviews · ${shortDate(day.date)}`}
            ></span>
          ))}
        </div>
        {first !== undefined && (
          <div className="axis">
            <span>{shortDate(first.date)}</span>
            <span>Today</span>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <span className="eyebrow">Due · next 7 days</span>
        <div className="forecast">
          {forecast.map((day) => (
            <div key={day.date}>
              <small>{weekdayLetter(day.date)}</small>
              <b>{day.count}</b>
            </div>
          ))}
        </div>
      </div>

      {calibration !== null && (
        <div className="legend" style={{ justifyContent: "space-between" }}>
          <span>Predicted vs actual recall</span>
          <b>{`${Math.round(calibration.predicted * 100)}% · ${Math.round(calibration.actual * 100)}%`}</b>
        </div>
      )}
    </Card>
  );
}
