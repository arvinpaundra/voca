import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Info } from "lucide-react";

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideTap = (event: PointerEvent) => {
      const tapped = event.target;
      const inside = tapped instanceof Node && wrapRef.current?.contains(tapped) === true;

      if (!inside) setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideTap);

    return () => document.removeEventListener("pointerdown", closeOnOutsideTap);
  }, [open]);

  const closeOnEscape = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape") setOpen(false);
  };

  return (
    <span className="tip-wrap" ref={wrapRef}>
      <button
        type="button"
        className="tip-btn"
        aria-label={label}
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={closeOnEscape}
      >
        <Info className="i" aria-hidden="true" />
      </button>

      {open && (
        <span className="tip" role="tooltip" id={tipId}>
          {children}
        </span>
      )}
    </span>
  );
}
