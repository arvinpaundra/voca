import { cx } from "./cx";

type TermProps = {
  term: string;
  reading?: string;
  lang?: string;
  // Pinyin and jyutping are Latin transcriptions, so the reading carries its own language.
  readingLang?: string;
  dir?: "auto" | "ltr" | "rtl";
  size?: "md" | "lg";
  className?: string | undefined;
};

// The term font and weight are the design's `.prompt .term` (--f-term); the readings follow `ruby rt` in globals.css.
export function Term({ term, reading, lang, readingLang, dir, size = "md", className }: TermProps) {
  return (
    <span
      className={cx("font-medium leading-[1.2]", size === "lg" ? "text-[76px]" : "text-[48px]", className)}
      style={{ fontFamily: "var(--f-term)" }}
      lang={lang}
      dir={dir}
    >
      {reading ? (
        <ruby>
          {term}
          <rt lang={readingLang}>{reading}</rt>
        </ruby>
      ) : (
        term
      )}
    </span>
  );
}
