import type { ReactNode } from "react";
import { cx } from "./cx";

type BadgeVariant = "default" | "lime" | "outline" | "new" | "learning" | "mature";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-stone-100 text-stone-700",
  lime: "bg-lime text-stone-900",
  outline: "border border-stone-300 text-stone-600",
  new: "bg-m-new text-stone-900",
  learning: "bg-m-learning text-stone-900",
  mature: "bg-m-mature text-white",
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
        "inline-flex h-5 items-center gap-1.5 rounded-[3px] px-2 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
