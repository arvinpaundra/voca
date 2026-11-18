import { useId, type ReactNode } from "react";
import { Card } from "../../components/Card";

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();

  return (
    <Card aria-labelledby={headingId}>
      <div className="card-head">
        <h2 id={headingId} className="h2">
          {title}
        </h2>
      </div>

      {children}
    </Card>
  );
}
