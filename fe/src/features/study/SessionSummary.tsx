import { Check } from "lucide-react";
import { Button } from "../../components/Button";
import { StatStrip } from "../../components/StatStrip";
import { tally } from "./progress";

export function SessionSummary({ firstAttempts, backHref }: { firstAttempts: readonly boolean[]; backHref: string }) {
  const { right, wrong, accuracy } = tally(firstAttempts);

  return (
    <section className="card complete">
      <span className="medal">
        <Check className="i i-lg" style={{ strokeWidth: 2.5 }} aria-hidden="true" />
      </span>

      <h1 className="h1">Session complete</h1>

      <div className="strip" style={{ width: "100%", maxWidth: 280, flex: "none" }} aria-hidden="true">
        {firstAttempts.map((correct, index) => (
          <i key={index} className={correct ? "r" : "w"} />
        ))}
      </div>

      <StatStrip
        className="w-full max-w-[340px] text-center"
        stats={[
          { label: "right", value: String(right) },
          { label: "wrong", value: String(wrong) },
          { label: "accuracy", value: accuracy === null ? "—" : `${Math.round(accuracy * 100)}%` },
        ]}
      />

      <div className="flex justify-center gap-2">
        <Button variant="secondary" href="/app">
          Dashboard
        </Button>
        <Button variant="primary" href={backHref}>
          Back to deck
        </Button>
      </div>
    </section>
  );
}
