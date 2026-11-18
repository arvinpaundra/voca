import type { ReactNode } from "react";
import { cx } from "./cx";

export function IconButton({
  label,
  onClick,
  href,
  disabled,
  round,
  className,
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  round?: boolean;
  className?: string | undefined;
  children: ReactNode;
}) {
  if (href !== undefined) {
    return (
      <a className={cx("btn-icon", round && "round", className)} href={href} aria-label={label} title={label}>
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={cx("btn-icon", round && "round", className)}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
