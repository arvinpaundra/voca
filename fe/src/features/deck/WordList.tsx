import { DateTime } from "effect";
import { Pencil, Trash2 } from "lucide-react";
import type { Deck, WordWithCards } from "@voca/contract";
import { Badge } from "../../components/Badge";
import { IconButton } from "../../components/IconButton";

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

export function WordList({
  deck,
  words,
  now,
  onEdit,
  onDelete,
}: {
  deck: Deck;
  words: readonly WordWithCards[];
  now: DateTime.Utc;
  onEdit: (word: WordWithCards) => void;
  onDelete: (word: WordWithCards) => void;
}) {
  return (
    <ul className="word-list" aria-label="Words">
      {words.map((word) => (
        <li key={word.slug}>
          <article className="word">
            <span className="w-term" lang={deck.termLang} dir="auto">
              {word.reading === null ? (
                word.term
              ) : (
                <ruby>
                  {word.term}
                  <rt>{word.reading}</rt>
                </ruby>
              )}
            </span>

            <div className="w-body">
              <span className="w-meaning" lang={deck.meaningLang} dir="auto">
                {word.meaning}
              </span>
              {word.example !== null && word.example !== "" && (
                <span className="w-example" lang={deck.termLang} dir="auto">
                  <Example example={word.example} term={word.term} />
                </span>
              )}
            </div>

            <div className="w-state">
              <StateBadge state={stateOf(word, now)} />
            </div>

            <div className="w-actions">
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
