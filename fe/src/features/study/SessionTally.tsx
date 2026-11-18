export function SessionTally({
  cleared,
  size,
  right,
  wrong,
}: {
  cleared: number;
  size: number;
  right: number;
  wrong: number;
}) {
  const answered = right + wrong;
  const accuracy = answered === 0 ? "—" : `${Math.round((right / answered) * 100)}%`;

  return (
    <aside className="card" aria-label="This session">
      <div className="card-head">
        <h2 className="h2">This session</h2>
      </div>

      <div className="kpi">
        <span className="v">
          {cleared}{" "}
          <span className="muted" style={{ fontSize: ".6em" }}>
            / {size}
          </span>
        </span>
        <span className="l">words cleared</span>
      </div>

      <div className="tally">
        <div>
          <span className="muted">Right</span>
          <b>{right}</b>
        </div>
        <div>
          <span className="muted">Wrong</span>
          <b>{wrong}</b>
        </div>
        <div>
          <span className="muted">Accuracy</span>
          <b>{accuracy}</b>
        </div>
      </div>
    </aside>
  );
}
