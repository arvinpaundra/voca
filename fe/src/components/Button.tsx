import type { ReactNode } from "react";
import { cx } from "./cx";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";

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
  busy?: boolean;
  children: ReactNode;
};

const variantClasses: Record<Variant, string> = {
  primary: "bg-navy text-white hover:bg-[#0a3d54]",
  // Kept so pages written against the old palette compile; it is the same as primary.
  accent: "bg-navy text-white hover:bg-[#0a3d54]",
  secondary: "border border-stone-300 bg-white text-stone-900 hover:bg-stone-50",
  ghost: "bg-transparent text-stone-700 hover:bg-stone-200/70",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const sizeClasses = {
  sm: "h-7 rounded-[5px] px-2.5",
  md: "h-8 rounded-md px-3",
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
  busy,
  children,
}: ButtonProps) {
  const classes = cx(
    "inline-flex cursor-pointer select-none items-center justify-center gap-2 text-sm font-semibold no-underline transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-not-allowed disabled:opacity-50",
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
      disabled={disabled === true || busy === true}
      aria-busy={busy === true ? true : undefined}
      aria-label={ariaLabel}
      title={title}
    >
      {busy === true && (
        <span
          aria-hidden="true"
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
