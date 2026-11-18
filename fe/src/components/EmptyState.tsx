import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-2 rounded-card border border-dashed border-stone-300 px-4 py-12 text-center">
      <span className="inline-flex size-10 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
        <Inbox className="size-5" aria-hidden="true" />
      </span>
      <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
      {body !== undefined && <p className="text-sm text-stone-500">{body}</p>}
      {action !== undefined && <div className="mt-2">{action}</div>}
    </div>
  );
}
