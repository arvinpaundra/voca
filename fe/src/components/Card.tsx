import type { HTMLAttributes } from "react";
import { cx } from "./cx";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-card border border-stone-200 bg-white p-6 shadow-sm", className)} {...props}>
      {children}
    </div>
  );
}
