import type { DateTime } from "effect";
import { Flame } from "lucide-react";
import type { WordDrillStats } from "@voca/contract";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { StatStrip } from "../../components/StatStrip";
import {
  dash,
  dateTime,
  dayCount,
  daysUntil,
  difficultyBand,
  dueDay,
  instantMillis,
  percent,
  ratingLabel,
  seconds,
  shortDate,
  stability,
  times,
} from "./wordFormat";

const MATURITY = { new: "New", learning: "Learning", mature: "Mature" } as const;

const dueLabel = (stats: WordDrillStats, now: DateTime.Utc, timezone: string): string => {
  if (stats.nextDue === null) return "next due";

  const left = daysUntil(stats.nextDue, now, timezone);
  if (left < 0) return "next due · overdue";
  if (left === 0) return "next due · today";

  return `next due · in ${left} ${left === 1 ? "day" : "days"}`;
};

// One drill of the word page: status and hard toggle, memory, effort, confused with, history.
export function DrillPanel({
  stats,
  timezone,
  now,
  busy,
  termLang,
  onToggleHard,
}: {
  stats: WordDrillStats;
  timezone: string;
  now: DateTime.Utc;
  busy?: boolean;
  termLang?: string;
  onToggleHard: (hard: boolean) => void;
}) {
  const confused = [...stats.confusedWith].sort((a, b) => b.count - a.count);

  // Sorted here so the strip and the rows are right whatever order the API lists the history in.
  const newestFirst = [...stats.history].sort((a, b) => instantMillis(b.at) - instantMillis(a.at));
  const oldestFirst = [...newestFirst].reverse();

  const accuracyLabel =
    stats.accuracy.last10 === null ? "accuracy" : `accuracy · ${percent(stats.accuracy.last10)} last 10`;

  return (
    <>
      <div className="drill-head">
        <Badge variant={stats.maturity === "mature" ? "navy" : "default"} dot={stats.maturity === "mature"}>
          {MATURITY[stats.maturity]}
        </Badge>

        {stats.leech && (
          <Badge variant="lime">{`Leech · ${stats.lapses} ${stats.lapses === 1 ? "lapse" : "lapses"}`}</Badge>
        )}

        <span className="grow"></span>

        <Button variant="secondary" size="sm" busy={busy === true} onClick={() => onToggleHard(!stats.isHard)}>
          <Flame className="i" aria-hidden="true" />
          {stats.isHard ? "Unmark hard" : "Mark as hard"}
        </Button>
      </div>

      <section className="deck-stats-strip" aria-label="Memory">
        <div className="kpi">
          <dd className="v">{percent(stats.recallNow)}</dd>
          <dt className="l">recall now</dt>
        </div>
        <div className="kpi">
          <dd className="v">{stability(stats.stabilityDays)}</dd>
          <dt className="l">stability</dt>
        </div>
        <div className="kpi">
          <dd className="v">{difficultyBand(stats.difficulty)}</dd>
          <dt className="l">difficulty</dt>
        </div>
        <div className="kpi">
          <dd className="v">{stats.nextDue === null ? dash : dueDay(stats.nextDue, timezone)}</dd>
          <dt className="l">{dueLabel(stats, now, timezone)}</dt>
        </div>
      </section>

      <div className="dash">
        <Card aria-label="Effort">
          <div className="card-head">
            <h2 className="h2">Effort and fluency</h2>
          </div>

          <StatStrip
            stats={[
              { label: "reviews", value: String(stats.reps) },
              { label: "lapses", value: String(stats.lapses) },
              { label: accuracyLabel, value: percent(stats.accuracy.overall) },
              { label: "median answer", value: seconds(stats.medianLatencyMs) },
              { label: "correct in a row", value: String(stats.streak) },
              {
                label: "attempts to clear",
                value: stats.attemptsToCorrect === null ? dash : stats.attemptsToCorrect.toFixed(1),
              },
            ]}
          />

          <div className="legend" style={{ justifyContent: "space-between" }}>
            <span>Easy vs hard mode accuracy</span>
            <b>{`${percent(stats.accuracy.easy)} · ${percent(stats.accuracy.hard)}`}</b>
          </div>

          <div className="legend" style={{ justifyContent: "space-between" }}>
            <span>First seen · last reviewed</span>
            <b>
              {`${stats.firstSeen === null ? dash : shortDate(stats.firstSeen, timezone)} · ${
                stats.lastReviewed === null ? dash : shortDate(stats.lastReviewed, timezone)
              }`}
            </b>
          </div>
        </Card>

        <Card aria-label="Confused with">
          <div className="card-head">
            <h2 className="h2">Confused with</h2>
          </div>

          {confused.length === 0 ? (
            <p className="muted">Nothing mixed up with this word yet.</p>
          ) : (
            <ul className="preview-list" style={{ border: 0 }}>
              {confused.map((entry) => (
                <li key={entry.wordSlug}>
                  <span className="t" lang={termLang} dir="auto">
                    {entry.term}
                  </span>
                  <span className="muted">{times(entry.count)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card aria-label="History">
        <div className="card-head">
          <h2 className="h2">History</h2>
          <span className="muted" style={{ fontSize: 12 }}>
            last 50 first attempts
          </span>
        </div>

        <div className="strip" style={{ maxWidth: 420 }}>
          {oldestFirst.map((entry, index) => (
            <i key={index} className={entry.correct ? "r" : "w"}></i>
          ))}
        </div>

        {/* Six columns stay on one line; on a phone the table scrolls sideways inside its card. */}
        <div className="hist-scroll">
          <ul className="hist">
            <li className="head">
              <span>Date</span>
              <span>Result</span>
              <span>Rating</span>
              <span className="num">Time</span>
              <span className="num">Recall</span>
              <span className="num">Interval</span>
            </li>

            {newestFirst.map((entry, index) => (
              <li key={index}>
                <span>{dateTime(entry.at, timezone)}</span>
                <span className={entry.correct ? "ok" : "no"}>{entry.correct ? "Right" : "Wrong"}</span>
                <span>{ratingLabel(entry.rating)}</span>
                <span className="num">{seconds(entry.latencyMs)}</span>
                <span className="num">{percent(entry.predictedRecall)}</span>
                <span className="num">{dayCount(entry.intervalDays)}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </>
  );
}
