import { DateTime } from "effect";
import { X } from "lucide-react";
import { drillLabel, type HardWord } from "@voca/contract";
import { Badge } from "../../components/Badge";
import { IconButton } from "../../components/IconButton";
import { termLangOf } from "./hardDrills";

export function HardWordList({
  words,
  now,
  onUnmark,
}: {
  words: readonly HardWord[];
  now: DateTime.Utc;
  onUnmark: (word: HardWord) => void;
}) {
  const nowMillis = DateTime.toEpochMillis(now);

  return (
    <ul className="word-list" aria-label="Hard words">
      {words.map((word) => {
        const lang = termLangOf(word);
        const hardCards = word.cards.filter((card) => card.isHard);
        const due = hardCards.some((card) => DateTime.toEpochMillis(DateTime.makeUnsafe(card.due)) <= nowMillis);

        const text =
          word.reading === null ? (
            word.term
          ) : (
            <ruby>
              {word.term}
              <rt lang={"not implemented: LF"}>{word.reading}</rt>
            </ruby>
          );

        return (
          <li key={word.slug}>
            <article className="word">
              <span className="w-term" lang={lang} dir="auto">
                {word.deck === undefined ? (
                  text
                ) : (
                  <a href={`/app/decks/${word.deck.slug}/words/${word.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                    {text}
                  </a>
                )}
              </span>

              <div className="w-body">
                <span className="w-meaning" lang={word.deck?.meaningLang} dir="auto">
                  {word.meaning}
                </span>
                {word.deck !== undefined && <span className="w-deck">{word.deck.title}</span>}
              </div>

              <div className="w-state">
                {due && <Badge variant="lime">Due</Badge>}
                {hardCards.map((card) => (
                  <Badge key={card.drill}>{drillLabel(lang, card.drill)}</Badge>
                ))}
              </div>

              <div className="w-actions">
                <IconButton label={`Unmark ${word.term} as hard`} onClick={() => onUnmark(word)}>
                  <X className="i" aria-hidden="true" />
                </IconButton>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
