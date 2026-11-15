import { cx } from "../../components/cx";

// "Vo" and "ca" in two tones, as in the prototype. Shared by the landing page and the sign-in screens.
export function BrandMark({ dark = false, className }: { dark?: boolean; className?: string }) {
  return (
    <span
      className={cx(
        "font-montserrat text-2xl font-semibold tracking-tighter",
        dark ? "text-white" : "text-stone-900",
        className,
      )}
    >
      Vo
      <span className={dark ? "text-stone-400" : "text-stone-500"}>ca</span>
    </span>
  );
}
