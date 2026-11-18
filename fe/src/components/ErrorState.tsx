import { CircleAlert } from "lucide-react";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="alert alert-bad">
      <CircleAlert className="i" aria-hidden="true" />
      <span className="grow">{message}</span>
      {onRetry !== undefined && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
