import type { Mode } from "@voca/contract";
import { SegmentedControl } from "../../components/SegmentedControl";

const MODE_OPTIONS: ReadonlyArray<{ value: Mode; label: string }> = [
  { value: "easy", label: "Easy" },
  { value: "hard", label: "Hard" }
];

export function ModeField({ value, onChange }: { value: Mode; onChange: (mode: Mode) => void }) {
  return (
    <SegmentedControl
      full
      label="Mode"
      options={MODE_OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
