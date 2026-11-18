import { Search } from "lucide-react";
import { useId } from "react";
import { cx } from "./cx";

export function SearchInput({
  label,
  placeholder,
  value,
  onChange,
  className,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
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
      />
    </div>
  );
}
