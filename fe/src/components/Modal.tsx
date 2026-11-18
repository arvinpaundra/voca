import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

const FOCUSABLE = "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

export function Modal({
  open,
  title,
  description,
  onClose,
  footer,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
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
      style={{
        border: 0,
        padding: 0,
        background: "transparent",
        margin: "auto",
        width: "min(480px, calc(100vw - 32px))",
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      <div className="modal">
        <div className="modal-head">
          <div>
            <h3 id={titleId}>{title}</h3>
            {description !== undefined && <p>{description}</p>}
          </div>
          <button type="button" className="btn-icon" aria-label="Close" onClick={onClose}>
            <X className="i" aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer !== undefined && <div className="modal-foot">{footer}</div>}
      </div>
    </dialog>
  );
}
