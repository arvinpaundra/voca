import { useState } from "react";
import type { Drill, SessionSize } from "@voca/contract";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ChoiceCard } from "../../components/ChoiceCard";
import { SessionSizeField } from "../study/SessionSizeField";
import type { HardDrill } from "./hardDrills";

export function HardStudySetup({
  drills,
  defaultSize,
  busy,
  error,
  onStart,
}: {
  drills: readonly HardDrill[];
  defaultSize: SessionSize;
  busy?: boolean;
  error?: string | null;
  onStart: (drills: readonly Drill[], size: SessionSize) => void;
}) {
  const [selected, setSelected] = useState<readonly Drill[]>(drills.map((entry) => entry.drill));
  const [size, setSize] = useState<SessionSize>(defaultSize);

  const toggle = (drill: Drill) => {
    setSelected((previous) =>
      previous.includes(drill) ? previous.filter((item) => item !== drill) : [...previous, drill],
    );
  };

  const start = () => {
    onStart(
      drills.map((entry) => entry.drill).filter((drill) => selected.includes(drill)),
      size,
    );
  };

  return (
    <Card className="mx-auto w-full max-w-[520px]" style={{ gap: 24 }}>
      <div className="ph-text" style={{ display: "grid", gap: 4 }}>
        <a className="back" href="/app/hard">
          <ArrowLeft className="i" aria-hidden="true" />
          Hard words
        </a>

        <h1 className="h1" style={{ fontSize: "calc(var(--h1) * .85)" }}>
          Study hard words
        </h1>
      </div>

      <div className="field">
        <span className="lbl">Drills</span>

        <div className="choices">
          {drills.map((entry) => (
            <ChoiceCard
              key={entry.drill}
              label={entry.label}
              meta={`${entry.count} hard`}
              checked={selected.includes(entry.drill)}
              onChange={() => toggle(entry.drill)}
            />
          ))}
        </div>
      </div>

      <div className="field">
        <span className="lbl">Session size</span>

        <SessionSizeField value={size} onChange={setSize} />
      </div>

      {error != null && (
        <p role="alert" style={{ color: "var(--bad)", fontSize: 13 }}>
          {error}
        </p>
      )}

      <div className="form-actions" style={{ alignItems: "center" }}>
        <Button variant="primary" busy={busy === true} disabled={selected.length === 0} onClick={start}>
          Start session
          <ArrowRight className="i" aria-hidden="true" />
        </Button>
      </div>
    </Card>
  );
}
