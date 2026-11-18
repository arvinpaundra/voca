import type { ReactNode } from "react";

export function SettingsRow({ label, help, children }: { label: string; help: string; children: ReactNode }) {
  return (
    <div className="set-row">
      <div className="lbl">
        <b>{label}</b>
        <span>{help}</span>
      </div>

      {children}
    </div>
  );
}
