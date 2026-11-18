import type { PublicDeck } from "@voca/contract";
import { GitFork } from "lucide-react";
import { Avatar } from "../../components/Avatar";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";

// 1200 -> "1.2k forks"; below a thousand the count is shown as it is.
export const forkLabel = (count: number): string => {
  const text = count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);

  return `${text} forks`;
};

export function PublicDeckRows({
  decks,
  forking,
  onFork,
}: {
  decks: readonly PublicDeck[];
  forking: string | null;
  onFork: (deck: PublicDeck) => void;
}) {
  return (
    <div>
      <div className="list-head pub-head">
        <span>Deck</span>
        <span>Author</span>
        <span>Languages</span>
        <span>Forks</span>
        <span></span>
      </div>

      {/* the card rules for .pub-grid and .pub come after the row rules for .deck-grid and .deck in console.css and win, but the Console design shows rows */}
      <ul className="deck-grid pub-grid" aria-label="Community decks" style={{ gridTemplateColumns: "1fr" }}>
        {decks.map((deck) => (
          <li key={deck.slug}>
            <article className="deck pub" style={{ gap: 16, gridTemplateRows: "none" }}>
              <div className="deck-top">
                <a className="deck-title" href={`/app/discover/${deck.slug}`} dir="auto">
                  {deck.title}
                </a>
              </div>

              <div className="author">
                <Avatar name={deck.owner.name} src={deck.owner.avatarUrl} />
                {deck.owner.name}
              </div>

              <div className="deck-tags">
                <Badge variant="outline" lang>
                  {`${deck.termLang} → ${deck.meaningLang}`}
                </Badge>
                <Badge>{`${deck.wordCount} words`}</Badge>
              </div>

              <div className="deck-foot">
                <span className="muted" style={{ fontSize: 12, display: "inline-flex", gap: 4, alignItems: "center" }}>
                  <GitFork className="i" style={{ width: 13, height: 13 }} aria-hidden="true" />
                  {forkLabel(deck.forkCount)}
                </span>

                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Fork ${deck.title}`}
                  disabled={forking !== null}
                  busy={forking === deck.slug}
                  onClick={() => onFork(deck)}
                >
                  Fork
                </Button>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
