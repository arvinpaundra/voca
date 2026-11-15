import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

// The native dialog gives focus trapping, Escape to close and the backdrop. Children mount only while open,
// so every opening starts from a fresh form.
export function Modal({ open, title, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[calc(100vh_-_4rem)] w-[min(520px,calc(100vw_-_2rem))] overflow-y-auto rounded-card bg-white p-0 text-stone-900 shadow-2xl backdrop:bg-stone-900/40 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="relative grid gap-4 p-6">
          <button
            type="button"
            aria-label="Close"
            title="Close"
            className="absolute right-4 top-4 inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-stone-100 text-stone-500 transition-colors hover:bg-stone-200 hover:text-stone-900"
            onClick={() => ref.current?.close()}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
          <h2 id={titleId} className="pr-10 text-xl font-semibold">
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}
