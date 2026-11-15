import { cx } from "./cx";

type TermProps = {
  term: string;
  reading?: string;
  lang?: string;
  dir?: "auto" | "ltr" | "rtl";
  size?: "md" | "lg";
  className?: string | undefined;
};

export function Term({ term, reading, lang, dir, size = "md", className }: TermProps) {
  return (
    <span
      className={cx(
        "font-term font-medium leading-[1.2]",
        size === "lg" ? "text-[76px]" : "text-[48px]",
        className,
      )}
      lang={lang}
      dir={dir}
    >
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
