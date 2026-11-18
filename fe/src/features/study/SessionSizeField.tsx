import type { SessionSize } from "@voca/contract";
import { SegmentedControl } from "../../components/SegmentedControl";

const SESSION_SIZES: readonly SessionSize[] = [7, 10, 15, 20];

export function SessionSizeField({ value, onChange }: { value: SessionSize; onChange: (size: SessionSize) => void }) {
  const options = SESSION_SIZES.map((size) => ({ value: String(size), label: String(size) }));

  return (
    <SegmentedControl
      full
      label="Session size"
      options={options}
      value={String(value)}
      onChange={(next) => {
        const picked = SESSION_SIZES.find((size) => String(size) === next);

        if (picked !== undefined) onChange(picked);
      }}
    />
  );
}
