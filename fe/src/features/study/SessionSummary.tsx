import { Button } from "../../components/Button";
import { PageHeader } from "../../components/PageHeader";
import { StatStrip } from "../../components/StatStrip";

export function SessionSummary({ right, wrong, backHref }: { right: number; wrong: number; backHref: string }) {
  const answered = right + wrong;
  const accuracy = answered === 0 ? "—" : `${Math.round((right / answered) * 100)}%`;

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col">
      <PageHeader title="Session complete" />

      <StatStrip
        stats={[
          { label: "Right", value: String(right) },
          { label: "Wrong", value: String(wrong) },
          { label: "Accuracy", value: accuracy },
        ]}
      />

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="ghost" href="/app">Dashboard</Button>
        <Button variant="primary" href={backHref}>Back to deck</Button>
      </div>
    </section>
  );
}
