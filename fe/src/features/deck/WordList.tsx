import { DateTime } from "effect";
import { Pencil, Trash2 } from "lucide-react";
import { readingLang, type Deck, type WordWithCards } from "@voca/contract";
import { Badge } from "../../components/Badge";
import { IconButton } from "../../components/IconButton";
import { cx } from "../../components/cx";
import { WORD_FONT_CLASS } from "../../lib/wordFont";

const MATURE_DAYS = 21;

type WordState = "Due" | "New" | "Mature" | "Learning";

// Card dates may arrive as DateTime or as ISO text, so both go through makeUnsafe.
const stateOf = (word: WordWithCards, now: DateTime.Utc): WordState => {
  const nowMillis = DateTime.toEpochMillis(now);

  if (word.cards.some((card) => DateTime.toEpochMillis(DateTime.makeUnsafe(card.due)) <= nowMillis)) return "Due";
  if (word.cards.length === 0) return "New";
  if (word.cards.some((card) => card.stabilityDays >= MATURE_DAYS)) return "Mature";
  return "Learning";
};

function StateBadge({ state }: { state: WordState }) {
  if (state === "Due") return <Badge variant="lime">Due</Badge>;

  if (state === "Mature") {
    return (
      <Badge variant="navy" dot>
        Mature
      </Badge>
    );
  }

  return <Badge>{state}</Badge>;
}

// The design bolds the term where it occurs in the example.
function Example({ example, term }: { example: string; term: string }) {
  const at = example.indexOf(term);
  if (at < 0) return <>{example}</>;

  return (
    <>
      {example.slice(0, at)}
      <b>{term}</b>
      {example.slice(at + term.length)}
    </>
  );
}

// The button keeps the term's type and colour instead of the browser's. Its click bubbles up to the row, which opens the word.
const termButtonStyle = {
  background: "none",
  border: 0,
  padding: 0,
  color: "inherit",
  font: "inherit",
  textAlign: "start",
  cursor: "pointer",
} as const;

export function WordList({
  deck,
  words,
  now,
  onOpen,
  onEdit,
  onDelete,
}: {
  deck: Deck;
  words: readonly WordWithCards[];
  now: DateTime.Utc;
  onOpen: (word: WordWithCards) => void;
  onEdit: (word: WordWithCards) => void;
  onDelete: (word: WordWithCards) => void;
}) {
  return (
    <ul className="word-list" aria-label="Words">
      {words.map((word) => (
        <li key={word.slug}>
          <article className="word row-open" onClick={() => onOpen(word)}>
            <span className={cx("w-term", WORD_FONT_CLASS)} lang={deck.termLang} dir="auto">
              <button type="button" aria-label={`Open ${word.term}`} style={termButtonStyle}>
                {word.reading === null ? (
                  word.term
                ) : (
                  <ruby>
                    {word.term}
                    <rt lang={readingLang(deck.termLang)}>{word.reading}</rt>
                  </ruby>
                )}
              </button>
            </span>

            <div className="w-body">
              <span className={cx("w-meaning", WORD_FONT_CLASS)} lang={deck.meaningLang} dir="auto">
                {word.meaning}
              </span>
              {word.example !== null && word.example !== "" && (
                <span className={cx("w-example", WORD_FONT_CLASS)} lang={deck.termLang} dir="auto">
                  <Example example={word.example} term={word.term} />
                </span>
              )}
            </div>

            <div className="w-state">
              <StateBadge state={stateOf(word, now)} />
            </div>

            {/* The row opens the word on any click, so the row's own buttons stop theirs from reaching it. */}
            <div className="w-actions" onClick={(event) => event.stopPropagation()}>
              <IconButton label={`Edit ${word.term}`} onClick={() => onEdit(word)}>
                <Pencil className="i" aria-hidden="true" />
              </IconButton>
              <IconButton label={`Delete ${word.term}`} onClick={() => onDelete(word)}>
                <Trash2 className="i" aria-hidden="true" />
              </IconButton>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
