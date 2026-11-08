import type { ReactNode } from "react";
import styles from "./container.module.css";

export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return <div className={[styles.container, className].filter(Boolean).join(" ")}>{children}</div>;
}
