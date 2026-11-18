import { useId, type InputHTMLAttributes } from "react";
import { cx } from "./cx";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string | undefined;
  error?: string | undefined;
};

export function Input({ label, error, id, className, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="grid gap-1.5">
      {label !== undefined && (
        <label htmlFor={inputId} className="text-xs font-medium text-stone-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error !== undefined ? true : undefined}
        aria-describedby={error !== undefined ? errorId : undefined}
        className={cx(
          "h-8 w-full rounded-lg border bg-white px-3 text-sm text-stone-900 placeholder:text-stone-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy",
          error !== undefined ? "border-red-400" : "border-stone-300 hover:border-stone-400",
          className,
        )}
        {...props}
      />
      {error !== undefined && (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
