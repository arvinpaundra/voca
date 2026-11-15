import { cx } from "./cx";

const sizeClasses = {
  sm: "size-4 border-2",
  md: "size-6 border-2",
  lg: "size-8 border-[3px]",
};

export function Spinner({
  size = "md",
  label = "Loading",
  className,
}: {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string | undefined;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cx("animate-spin rounded-full border-stone-200 border-t-lime", sizeClasses[size], className)}
    />
  );
}
