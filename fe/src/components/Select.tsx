import { useId } from "react";
import { cx } from "./cx";

export type SelectOption = { value: string; label: string };

export function Select({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  className?: string | undefined;
}) {
  const id = useId();

  return (
    <>
      <label htmlFor={id} className="sr">
        {label}
      </label>
      <select id={id} className={cx("select", className)} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );
}
