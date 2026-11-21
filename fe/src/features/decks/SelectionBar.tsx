import { Button } from "../../components/Button";

// The bar over the deck list while decks are selected: how many, and what to do with them.
export function SelectionBar({
  count,
  onSnooze,
  onUnsnooze,
  onDelete,
  onClear,
}: {
  count: number;
  onSnooze: () => void;
  onUnsnooze: () => void;
  onDelete?: () => void;
  onClear: () => void;
}) {
  return (
    <section role="region" aria-label="Selected decks" className="toolbar">
      <span>{count} selected</span>

      <Button variant="secondary" size="sm" onClick={onSnooze}>
        Snooze
      </Button>

      <Button variant="secondary" size="sm" onClick={onUnsnooze}>
        Unsnooze
      </Button>

      <Button variant="danger" size="sm" onClick={() => onDelete?.()}>
        Delete
      </Button>

      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear
      </Button>
    </section>
  );
}
