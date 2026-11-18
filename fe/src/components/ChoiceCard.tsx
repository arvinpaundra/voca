import { Check } from "lucide-react";
import { cx } from "./cx";

export function ChoiceCard({
  label,
  meta,
  checked,
  onChange,
}: {
  label: string;
  meta?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={cx("choice", checked && "on")}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="box">
        <Check className="i" aria-hidden="true" />
      </span>
      <span className="t">{label}</span>
      {meta !== undefined && <span className="m">{meta}</span>}
    </label>
  );
}
