import type { DeckSummary } from "@voca/contract";
import { Moon } from "lucide-react";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Menu } from "../../components/Menu";
import { snoozeLabel, snoozeShortLabel } from "./snooze";

export function DeckRows({
  decks,
  onEdit,
  onDelete,
  timezone = "UTC",
  selected,
  onToggleSelect,
}: {
  decks: readonly DeckSummary[];
  onEdit: (deck: DeckSummary) => void;
  onDelete: (deck: DeckSummary) => void;
  // The Learner's timezone, for the date a snooze ends.
  timezone?: string;
  // Selection for snoozing several decks at once; rows have no checkbox without `onToggleSelect`.
  selected?: ReadonlySet<string>;
  onToggleSelect?: (deck: DeckSummary) => void;
}) {
  return (
    <div>
      <div className="list-head">
        <span>Deck</span>
        <span>Languages</span>
        <span>Due</span>
        <span>Words</span>
        <span></span>
        <span></span>
      </div>

      <ul className="deck-grid" aria-label="Decks">
        {decks.map((deck) => {
          const snoozeText = snoozeLabel(deck.snooze, timezone);
          const snoozed = snoozeText !== null;

          return (
            <li key={deck.slug}>
              <article className={snoozed ? "deck snoozed" : "deck"}>
                <div className="deck-top">
                  {/* The checkbox shares the title's cell. */}
                  <div className="deck-head">
                    {onToggleSelect !== undefined && (
                      <input
                        type="checkbox"
                        aria-label={`Select ${deck.title}`}
                        checked={selected?.has(deck.slug) ?? false}
                        onChange={() => onToggleSelect(deck)}
                      />
                    )}

                    {snoozed && <Moon className="deck-moon" size={14} aria-hidden="true" />}

                    <a className="deck-title" href={`/app/decks/${deck.slug}`} dir="auto">
                      {deck.title}
                    </a>
                  </div>

                  <Menu
                    label={`Actions for ${deck.title}`}
                    className="order-5 justify-self-end"
                    items={[
                      { label: "Edit deck", onSelect: () => onEdit(deck) },
                      { label: "Delete deck", danger: true, onSelect: () => onDelete(deck) },
                    ]}
                  />
                </div>

                <div className="deck-tags">
                  <Badge variant="outline" lang>
                    {`${deck.termLang} → ${deck.meaningLang}`}
                  </Badge>
                  {deck.visibility === "public" && <Badge variant="lime">Public</Badge>}
                  {snoozed && (
                    // A plain span: the short text is hidden from screen readers, which get the full label instead.
                    <span className="badge badge-navy" title={snoozeText}>
                      <Moon size={12} aria-hidden="true" />
                      <span aria-hidden="true">{snoozeShortLabel(deck.snooze, timezone)}</span>
                      <span className="sr-only">{snoozeText}</span>
                    </span>
                  )}
                </div>

                <div className="deck-stats">
                  <div>
                    <span className={deck.dueCount === 0 ? "due num zero" : "due num"}>{deck.dueCount}</span>
                    <small>due</small>
                  </div>
                  <div className="words-col">
                    <span className="words num">{deck.wordCount}</span>
                    <small>words</small>
                  </div>
                </div>

                <div className="deck-foot">
                  {deck.wordCount === 0 ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      href={`/app/decks/${deck.slug}`}
                      aria-label={`Add words to ${deck.title}`}
                    >
                      Add words
                    </Button>
                  ) : (
                    <Button
                      variant={!snoozed && deck.dueCount > 0 ? "primary" : "secondary"}
                      size="sm"
                      href={`/app/decks/${deck.slug}/study`}
                      aria-label={`Study ${deck.title}`}
                    >
                      Study
                    </Button>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
