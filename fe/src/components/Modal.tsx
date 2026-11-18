import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

const FOCUSABLE = "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

export function Modal({
  open,
  title,
  onClose,
  footer,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (element === null) return;

    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();

    // Not every engine moves focus into the dialog on showModal().
    if (open) element.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;

        event.preventDefault();
        onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-card border border-stone-200 bg-white p-0 text-stone-900 backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between gap-4 border-b border-stone-200 px-4 py-3">
        <h2 id={titleId} className="font-montserrat text-base font-semibold">
          {title}
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-[5px] text-stone-500 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="p-4 text-sm">{children}</div>
      {footer !== undefined && (
        <div className="flex justify-end gap-2 border-t border-stone-200 px-4 py-3">{footer}</div>
      )}
    </dialog>
  );
}
