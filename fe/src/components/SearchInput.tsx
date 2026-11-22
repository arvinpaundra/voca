import { Search } from "lucide-react";
import { useId } from "react";
import { cx } from "./cx";

export function SearchInput({
  label,
  placeholder,
  value,
  onChange,
  onSubmit,
  className,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  /** Enter in the box: searches now instead of after the delay. */
  onSubmit?: () => void;
  className?: string | undefined;
}) {
  const id = useId();

  return (
    <div className={cx("search", className)}>
      <label htmlFor={id} className="sr">
        {label}
      </label>
      <Search className="i" aria-hidden="true" />
      <input
        id={id}
        type="search"
        className="input"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;

          onSubmit?.();
        }}
      />
    </div>
  );
}
