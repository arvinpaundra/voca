import styles from "./term.module.css";

type TermProps = {
  term: string;
  reading?: string;
  lang?: string;
  dir?: "auto" | "ltr" | "rtl";
  size?: "md" | "lg";
  className?: string | undefined;
};

export function Term({ term, reading, lang, dir, size = "md", className }: TermProps) {
  const classes = [styles.term, size === "lg" && styles.lg, className].filter(Boolean).join(" ");
  return (
    <span className={classes} lang={lang} dir={dir}>
      {reading ? (
        <ruby>
          {term}
          <rt>{reading}</rt>
        </ruby>
      ) : (
        term
      )}
    </span>
  );
}
