import type { ReactNode } from "react";

export function SettingsRow({
  label,
  help,
  info,
  children,
}: {
  label: string;
  help: string;
  info?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="set-row">
      <div className="lbl">
        <b>
          {label}
          {info === undefined ? null : <> {info}</>}
        </b>
        <span>{help}</span>
      </div>

      {children}
    </div>
  );
}
