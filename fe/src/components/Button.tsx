import type { ReactNode } from "react";
import styles from "./button.module.css";

type Variant = "primary" | "accent" | "ghost";

type ButtonProps = {
  variant?: Variant;
  href?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  className?: string | undefined;
  children: ReactNode;
};

export function Button({
  variant,
  href,
  type = "button",
  onClick,
  disabled,
  className,
  children,
}: ButtonProps) {
  const classes = [styles.btn, variant && styles[variant], className].filter(Boolean).join(" ");
  if (href) {
    return (
      <a className={classes} href={href}>
        {children}
      </a>
    );
  }
  return (
    <button className={classes} type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
