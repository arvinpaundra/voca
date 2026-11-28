import { Check, Flame } from "lucide-react";
import type { Drill } from "@voca/contract";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { WordText } from "../../components/WordText";

/** A word answered in this tab's session: its first attempt, and whether it is (or should be) hard. */
export type SessionWordItem = {
  readonly wordSlug: string;
  readonly drill: Drill;
  readonly term: string;
  readonly meaning: string;
  readonly lang: string;
  readonly correct: boolean;
  readonly leech: boolean;
  readonly hard: boolean;
};

export function SessionWords({
  items,
  drillLabel,
  onToggleHard,
}: {
  items: readonly SessionWordItem[];
  drillLabel: string;
  onToggleHard: (item: SessionWordItem) => void;
}) {
  return (
    <Card aria-label="Words in this session">
      <div className="card-head">
        <h2 className="h2">Words in this session</h2>
        <span className="muted" style={{ fontSize: 12 }}>
          {drillLabel}
        </span>
      </div>

      <ul className="word-list sess" style={{ border: 0 }}>
        {items.map((item) => (
          <li key={item.wordSlug}>
            <article className="word">
              <span className="w-term" lang={item.lang} dir="auto">
                <WordText text={item.term} faceLang={item.lang} />
              </span>

              <div className="w-body">
                <span className="w-meaning">
                  <WordText text={item.meaning} faceLang={item.lang} />
                </span>
              </div>

              {/* A fixed width keeps the dot aligned whether or not the "Suggested" badge is shown. */}
              <div className="w-state">
                <span className={item.correct ? "w-mark" : "w-mark w"} />
                {item.leech && !item.hard && <Badge variant="lime">Suggested</Badge>}
              </div>

              {/* A fixed width keeps the dot column aligned: "Mark hard" is wider than "Hard". */}
              <div className="w-actions">
                {item.hard ? (
                  <Button variant="ghost" size="sm" aria-label={`Unmark ${item.term}`} onClick={() => onToggleHard(item)}>
                    <Check className="i" aria-hidden="true" />
                    Hard
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Mark ${item.term} hard`}
                    onClick={() => onToggleHard(item)}
                  >
                    <Flame className="i" aria-hidden="true" />
                    Mark hard
                  </Button>
                )}
              </div>
            </article>
          </li>
        ))}
      </ul>
    </Card>
  );
}
