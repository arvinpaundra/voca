import { useEffect, useRef, useState } from "react";
import { cx } from "./cx";
import { MoreIcon } from "./MoreIcon";

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean };

// `trigger`: the design's bare icon button in rows, or a bordered secondary button in page headers.
export function Menu({
  label,
  items,
  trigger = "icon",
  className,
}: {
  label: string;
  items: ReadonlyArray<MenuItem>;
  trigger?: "icon" | "secondary";
  className?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onClick = (event: MouseEvent) => {
      if (root.current !== null && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      setOpen(false);
      button.current?.focus();
    };

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={className} style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={trigger === "secondary" ? "btn btn-secondary" : "btn-icon"}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreIcon />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className="menu"
          style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, zIndex: 20 }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={cx(item.danger === true && "bad")}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
