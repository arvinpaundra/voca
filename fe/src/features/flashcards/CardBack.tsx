import { readingLang, type Word } from "@voca/contract";
import { WordText } from "../../components/WordText";

// The back of a flipped card: the reading, meaning, example and notes, never the term.
export function CardBack({ card, termLang }: { card: Word; termLang: string }) {
  return (
    <>
      {card.reading !== null && card.reading !== "" && (
        <p lang={readingLang(termLang)} style={{ fontSize: 28 }}>
          <WordText text={card.reading} faceLang={termLang} />
        </p>
      )}

      <p>
        <WordText text={card.meaning} faceLang={termLang} />
      </p>

      {card.example !== null && (
        <p lang={termLang}>
          <WordText text={card.example} faceLang={termLang} />
        </p>
      )}

      {card.notes !== null && (
        <p className="muted">
          <WordText text={card.notes} faceLang={termLang} />
        </p>
      )}
    </>
  );
}
