import { useRef, type KeyboardEvent } from "react";
import { cx } from "./cx";

export type SegmentOption<T extends string> = { value: T; label: string };

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string | undefined;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (event: KeyboardEvent, index: number) => {
    let step = 0;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") step = 1;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") step = -1;
    if (step === 0) return;

    event.preventDefault();

    const target = (index + step + options.length) % options.length;
    const next = options[target];
    if (next === undefined) return;

    onChange(next.value);
    refs.current[target]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx("inline-flex gap-0.5 rounded-lg border border-stone-200 bg-stone-100 p-0.5", className)}
    >
      {options.map((option, index) => {
        const checked = option.value === value;

        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => move(event, index)}
            className={cx(
              "h-7 cursor-pointer rounded-[5px] px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy",
              checked ? "bg-white text-stone-900 ring-1 ring-stone-200" : "text-stone-600 hover:text-stone-900",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
