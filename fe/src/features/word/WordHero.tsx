import { readingLang, type Word } from "@voca/contract";
import { WordText } from "../../components/WordText";

export function WordHero({ word, termLang, meaningLang }: { word: Word; termLang: string; meaningLang: string }) {
  return (
    <div className="word-hero">
      <p className="t" lang={termLang} dir="auto">
        {word.reading === null ? (
          <WordText text={word.term} faceLang={termLang} />
        ) : (
          <ruby>
            <WordText text={word.term} faceLang={termLang} />
            <rt lang={readingLang(termLang)}>
              <WordText text={word.reading} faceLang={termLang} />
            </rt>
          </ruby>
        )}
      </p>

      <span className="m" lang={meaningLang} dir="auto">
        <WordText text={word.meaning} faceLang={termLang} />
      </span>

      {word.example !== null && word.example !== "" && (
        <span className="muted" lang={termLang} dir="auto" style={{ fontSize: 13 }}>
          <WordText text={word.example} faceLang={termLang} />
        </span>
      )}
    </div>
  );
}
