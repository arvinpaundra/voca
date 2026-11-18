import type { ReactNode } from "react";

// new/learning/mature are kept for pages written before ADR 36: new and learning render the plain badge, mature navy.
export type BadgeVariant = "default" | "outline" | "lime" | "navy" | "new" | "learning" | "mature";

export function Badge(_props: {
  variant?: BadgeVariant;
  dot?: boolean;
  lang?: boolean;
  className?: string | undefined;
  children: ReactNode;
}) {
  return <p>not implemented: UI-K2</p>;
}
