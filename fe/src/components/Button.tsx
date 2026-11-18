import type { ReactNode } from "react";
import { cx } from "./cx";

// `accent` is an alias of `primary` (pages written before ADR 36); `lime` is the design's .btn-lime.
export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "lime";

export function Button({
  variant = "primary",
  size = "md",
  href,
  type = "button",
  onClick,
  disabled,
  className,
  "aria-label": ariaLabel,
  title,
  busy,
  children,
}: {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  href?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  className?: string | undefined;
  "aria-label"?: string;
  title?: string;
  busy?: boolean;
  children: ReactNode;
}) {
  const classes = cx(
    "btn",
    "btn-" + (variant === "accent" ? "primary" : variant),
    size === "sm" && "btn-sm",
    busy === true && "btn-busy",
    className,
  );

  if (href !== undefined) {
    return (
      <a className={classes} href={href} aria-label={ariaLabel} title={title}>
        {children}
      </a>
    );
  }

  return (
    <button
      className={classes}
      type={type}
      onClick={onClick}
      disabled={disabled === true || busy === true}
      aria-busy={busy === true ? true : undefined}
      aria-label={ariaLabel}
      title={title}
    >
      {children}
    </button>
  );
}
