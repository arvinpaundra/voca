import type { ReactNode } from "react";
import { cx } from "./cx";

export function IconButton({
  label,
  onClick,
  href,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  className?: string | undefined;
  children: ReactNode;
}) {
  if (href !== undefined) {
    return (
      <a className={cx("btn-icon", className)} href={href} aria-label={label} title={label}>
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={cx("btn-icon", className)}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
