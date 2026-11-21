import { readingLang, type Word } from "@voca/contract";

// The back of a flipped card: the reading, meaning, example and notes, never the term.
export function CardBack({ card, termLang }: { card: Word; termLang: string }) {
  return (
    <>
      {card.reading !== null && card.reading !== "" && (
        <p lang={readingLang(termLang)} style={{ fontSize: 28 }}>
          {card.reading}
        </p>
      )}

      <p>{card.meaning}</p>

      {card.example !== null && <p lang={termLang}>{card.example}</p>}

      {card.notes !== null && <p className="muted">{card.notes}</p>}
    </>
  );
}
