// A muted status line above the prompt; nothing renders when there is no notice.
export function SessionNotice({ notice }: { notice: string | null }) {
  if (notice === null) return null;

  return <p className="muted" role="status">{notice}</p>;
}
