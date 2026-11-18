import { Button } from "./Button";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="grid justify-items-center gap-3 rounded-card border border-red-200 bg-red-50 px-4 py-8 text-center"
    >
      <p className="text-sm text-red-700">{message}</p>
      {onRetry !== undefined && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
