import { cx } from "./cx";

export function Skeleton({ label, rows = 3, className }: { label: string; rows?: number; className?: string | undefined }) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className={cx("grid gap-2", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} aria-hidden="true" className="h-10 animate-pulse rounded-lg bg-stone-200/70" />
      ))}
    </div>
  );
}
