import { readingLang, type Word } from "@voca/contract";
import { WORD_FONT_CLASS } from "../../lib/wordFont";

// Everything in the hero is the word's content, so the whole block takes the word font.
export function WordHero({ word, termLang, meaningLang }: { word: Word; termLang: string; meaningLang: string }) {
  return (
    <div className={`word-hero ${WORD_FONT_CLASS}`}>
      <p className="t" lang={termLang} dir="auto">
        {word.reading === null ? (
          word.term
        ) : (
          <ruby>
            {word.term}
            <rt lang={readingLang(termLang)}>{word.reading}</rt>
          </ruby>
        )}
      </p>

      <span className="m" lang={meaningLang} dir="auto">
        {word.meaning}
      </span>

      {word.example !== null && word.example !== "" && (
        <span className="muted" lang={termLang} dir="auto" style={{ fontSize: 13 }}>
          {word.example}
        </span>
      )}
    </div>
  );
}
