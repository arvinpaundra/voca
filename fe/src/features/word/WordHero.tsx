import { readingLang, type Word } from "@voca/contract";

export function WordHero({ word, termLang, meaningLang }: { word: Word; termLang: string; meaningLang: string }) {
  return (
    <div className="word-hero">
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
