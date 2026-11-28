import { cx } from "./cx";
import { WordText } from "./WordText";

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
// The face is a class, not an inline style, so the word font can override it.
export function Term({ term, reading, lang, readingLang, dir, size = "md", className }: TermProps) {
  return (
    <span
      className={cx("term-face font-medium leading-[1.2]", size === "lg" ? "text-[76px]" : "text-[48px]", className)}
      lang={lang}
      dir={dir}
    >
      {reading ? (
        <ruby>
          <WordText text={term} faceLang={lang} />
          <rt lang={readingLang}>
            <WordText text={reading} faceLang={lang} />
          </rt>
        </ruby>
      ) : (
        <WordText text={term} faceLang={lang} />
      )}
    </span>
  );
}
