import type { SnoozeDays } from "@voca/contract";
import { Button } from "../../components/Button";
import { Modal } from "../../components/Modal";

const CHOICES: readonly { label: string; days: SnoozeDays | null }[] = [
  { label: "1 day", days: 1 },
  { label: "3 days", days: 3 },
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "Until I unsnooze", days: null },
];

// Asks how long to snooze one deck or the selected ones: 1, 3, 7 or 14 days, or until unsnoozed (null).
export function SnoozeModal({
  open,
  count,
  busy,
  onSnooze,
  onClose,
}: {
  open: boolean;
  count: number;
  busy?: boolean;
  onSnooze: (days: SnoozeDays | null) => void;
  onClose: () => void;
}) {
  const title = count === 1 ? "Snooze deck" : `Snooze ${count} decks`;

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="grid gap-2">
        {CHOICES.map((choice) => (
          <Button
            key={choice.label}
            variant="secondary"
            busy={busy === true}
            onClick={() => onSnooze(choice.days)}
          >
            {choice.label}
          </Button>
        ))}
      </div>
    </Modal>
  );
}
