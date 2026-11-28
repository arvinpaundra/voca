import type { ReactNode } from "react";

export function Tooltip({ label }: { label: string; children: ReactNode }) {
  return <span data-label={label}>not implemented: NF</span>;
}
