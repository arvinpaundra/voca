import type { SnoozeDays } from "@voca/contract";

// Asks how long to snooze one deck or the selected ones: 1, 3, 7 or 14 days, or until unsnoozed (null).
export function SnoozeModal(_props: {
  open: boolean;
  count: number;
  busy?: boolean;
  onSnooze: (days: SnoozeDays | null) => void;
  onClose: () => void;
}) {
  return <p>not implemented: FD</p>;
}
