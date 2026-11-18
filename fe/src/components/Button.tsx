import type { ReactNode } from "react";

// `accent` is an alias of `primary` (pages written before ADR 36); `lime` is the design's .btn-lime.
export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "lime";

export function Button(_props: {
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
  return <p>not implemented: UI-K2</p>;
}
