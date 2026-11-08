import type { ReactNode } from "react";
import { Container } from "./Container";
import styles from "./section.module.css";

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
    <section className={styles.section} id={id}>
      <Container>
        <header className={styles.head}>
          <h2 className={styles.title}>{title}</h2>
          <span className="label">{eyebrow}</span>
        </header>
        {children}
      </Container>
    </section>
  );
}
