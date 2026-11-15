import { cx } from "./cx";

// "Vo" and "ca" in two tones, as in the voca-bak prototype. The text reads "Voca" to assistive tech.
export function Wordmark({
  variant = "default",
  className,
}: {
  variant?: "default" | "dark";
  className?: string | undefined;
}) {
  return (
    <span
      className={cx(
        "font-sans text-2xl font-semibold tracking-tighter",
        variant === "dark" ? "text-white" : "text-stone-900",
        className,
      )}
    >
      Vo
      <span className={variant === "dark" ? "text-stone-400" : "text-stone-500"}>ca</span>
    </span>
  );
}
