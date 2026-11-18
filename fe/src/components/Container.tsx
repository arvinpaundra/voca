import type { ReactNode } from "react";
import { cx } from "./cx";

// The design's page width (.content is 1120px); the landing page and the sign-in pages use it outside the shell.
export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return <div className={cx("mx-auto w-full max-w-[1120px] px-4", className)}>{children}</div>;
}
