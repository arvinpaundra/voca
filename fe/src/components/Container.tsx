import type { ReactNode } from "react";
import { cx } from "./cx";

export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return <div className={cx("mx-auto w-full max-w-[1180px] px-4", className)}>{children}</div>;
}
