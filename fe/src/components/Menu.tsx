import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cx } from "./cx";

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean };

export function Menu({
  label,
  items,
  className,
}: {
  label: string;
  items: ReadonlyArray<MenuItem>;
  className?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onClick = (event: MouseEvent) => {
      if (root.current !== null && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      setOpen(false);
      trigger.current?.focus();
    };

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={cx("relative inline-block", className)}>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-[5px] text-stone-500 hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute right-0 z-20 mt-1 min-w-40 rounded-lg border border-stone-200 bg-white p-1"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cx(
                "flex h-8 w-full cursor-pointer items-center rounded-[5px] px-2 text-left text-sm hover:bg-stone-100",
                item.danger === true ? "text-red-600" : "text-stone-900",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
