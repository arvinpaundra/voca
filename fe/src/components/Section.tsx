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
        <header className="mb-5 flex items-baseline gap-3 border-b border-stone-200 pb-2">
          <h2 className="text-[28px]">{title}</h2>
          <span className="label">{eyebrow}</span>
        </header>
        {children}
      </Container>
    </section>
  );
}
