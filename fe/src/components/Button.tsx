import type { ReactNode } from "react";
import { cx } from "./cx";

type Variant = "primary" | "accent" | "ghost" | "danger";

type ButtonProps = {
  variant?: Variant;
  size?: "sm" | "md";
  href?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  className?: string | undefined;
  "aria-label"?: string;
  title?: string;
  children: ReactNode;
};

const variantClasses: Record<Variant, string> = {
  primary: "bg-lime text-stone-900 hover:bg-lime-hover",
  accent: "bg-navy text-white hover:bg-navy/85",
  ghost: "bg-transparent text-stone-700 hover:bg-stone-200/70",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const sizeClasses = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
};

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
  children,
}: ButtonProps) {
  const classes = cx(
    "inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-lg font-semibold no-underline transition-colors duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );

  if (href) {
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
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
    >
      {children}
    </button>
  );
}
