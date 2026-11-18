import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  body,
  icon,
  action,
}: {
  title: string;
  body?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="ico">{icon ?? <Inbox className="i i-lg" aria-hidden="true" />}</span>
      <b role="heading" aria-level={3}>
        {title}
      </b>
      {body !== undefined && <p>{body}</p>}
      {action}
    </div>
  );
}
