import { readingLang, type Word } from "@voca/contract";
import { WORD_FONT_CLASS } from "../../lib/wordFont";

// The back of a flipped card: the reading, meaning, example and notes, never the term.
export function CardBack({ card, termLang }: { card: Word; termLang: string }) {
  return (
    <>
      {card.reading !== null && card.reading !== "" && (
        <p className={WORD_FONT_CLASS} lang={readingLang(termLang)} style={{ fontSize: 28 }}>
          {card.reading}
        </p>
      )}

      <p className={WORD_FONT_CLASS}>{card.meaning}</p>

      {card.example !== null && (
        <p className={WORD_FONT_CLASS} lang={termLang}>
          {card.example}
        </p>
      )}

      {card.notes !== null && <p className={`muted ${WORD_FONT_CLASS}`}>{card.notes}</p>}
    </>
  );
}
