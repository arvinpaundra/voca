import { useId, type ReactNode } from "react";

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="grid gap-4">
      <div className="grid gap-1">
        <h2 id={headingId} className="font-montserrat text-base font-semibold text-stone-900">
          {title}
        </h2>
        {description !== undefined && <p className="text-sm text-stone-500">{description}</p>}
      </div>

      <div className="grid gap-6 rounded-card border border-stone-200 bg-white p-6">{children}</div>
    </section>
  );
}
