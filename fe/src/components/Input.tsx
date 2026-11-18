import { useId, type InputHTMLAttributes } from "react";
import { cx } from "./cx";

export function Input({
  label,
  hint,
  error,
  id,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string | undefined;
  hint?: string | undefined;
  error?: string | undefined;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const noteId = inputId + "-note";
  const note = error ?? hint;

  return (
    <div className="field">
      {label !== undefined && <label htmlFor={inputId}>{label}</label>}
      <input
        id={inputId}
        aria-invalid={error !== undefined ? true : undefined}
        aria-describedby={note !== undefined ? noteId : undefined}
        className={cx("input", error !== undefined && "is-bad", className)}
        {...props}
      />
      {error !== undefined && (
        <p id={noteId} className="err">
          {error}
        </p>
      )}
      {error === undefined && hint !== undefined && (
        <p id={noteId} className="hint">
          {hint}
        </p>
      )}
    </div>
  );
}
