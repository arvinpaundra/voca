import type { ReactNode } from "react";
import { Container } from "./Container";

export function Section({
  id,
  title,
  eyebrow,
  children,
}: {
  id?: string;
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <section className="pt-14" id={id}>
      <Container>
        <header
          className="mb-5 flex items-baseline gap-3 pb-2"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <h2 className="h1" style={{ fontSize: 28, lineHeight: 1.1 }}>
            {title}
          </h2>
          <span className="eyebrow">{eyebrow}</span>
        </header>
        {children}
      </Container>
    </section>
  );
}
