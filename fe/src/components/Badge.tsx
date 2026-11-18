import type { ReactNode } from "react";
import { cx } from "./cx";

// new/learning/mature are kept for pages written before ADR 36: new and learning render the plain badge, mature navy.
export type BadgeVariant = "default" | "outline" | "lime" | "navy" | "new" | "learning" | "mature";

const VARIANT: Record<BadgeVariant, string | false> = {
  default: false,
  new: false,
  learning: false,
  outline: "badge-outline",
  lime: "badge-lime",
  navy: "badge-navy",
  mature: "badge-navy",
};

export function Badge({
  variant = "default",
  dot,
  lang,
  className,
  children,
}: {
  variant?: BadgeVariant;
  dot?: boolean;
  lang?: boolean;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <span className={cx("badge", VARIANT[variant], dot === true && "badge-dot", lang === true && "lang", className)}>
      {children}
    </span>
  );
}
