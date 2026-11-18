import { useRef, type KeyboardEvent } from "react";
import { cx } from "./cx";

export type SegmentOption<T extends string> = { value: T; label: string };

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  full,
  className,
}: {
  label: string;
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  full?: boolean;
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
    <div role="radiogroup" aria-label={label} className={cx("seg", full === true && "full", className)}>
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
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
