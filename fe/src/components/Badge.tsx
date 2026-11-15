import type { ReactNode } from "react";
import { cx } from "./cx";

type BadgeVariant = "default" | "lime" | "outline";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-stone-100 text-stone-700",
  lime: "bg-lime text-stone-900",
  outline: "border border-stone-300 text-stone-600",
};

export function Badge({
  variant = "default",
  className,
  children,
}: {
  variant?: BadgeVariant;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
