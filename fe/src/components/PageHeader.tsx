import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export function PageHeader({
  title,
  eyebrow,
  description,
  meta,
  back,
  actions,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  meta?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="ph-text">
        {back !== undefined && (
          <a className="back" href={back.href}>
            <ArrowLeft className="i" aria-hidden="true" />
            {back.label}
          </a>
        )}
        {eyebrow !== undefined && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="h1">{title}</h1>
        {meta !== undefined && <div className="ph-meta">{meta}</div>}
        {description !== undefined && <p className="sub">{description}</p>}
      </div>
      {actions !== undefined && <div className="ph-actions">{actions}</div>}
    </header>
  );
}
