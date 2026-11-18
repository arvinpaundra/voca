import type { DeckSummary } from "@voca/contract";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Menu } from "../../components/Menu";

type DeckTableProps = {
  decks: readonly DeckSummary[];
  onEdit: (deck: DeckSummary) => void;
  onDelete: (deck: DeckSummary) => void;
};

const headerClass = "h-8 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500";

export function DeckTable({ decks, onEdit, onDelete }: DeckTableProps) {
  return (
    <div className="rounded-card border border-stone-200 bg-white">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Decks</caption>

        <thead>
          <tr>
            <th scope="col" className={headerClass}>
              Deck
            </th>
            <th scope="col" className={headerClass}>
              Language
            </th>
            <th scope="col" className={`${headerClass} text-right`}>
              Due
            </th>
            <th scope="col" className={`${headerClass} text-right`}>
              Words
            </th>
            <th scope="col" className={`${headerClass} w-40 text-right`}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {decks.map((deck) => (
            <tr key={deck.slug} className="h-11 border-t border-stone-200 hover:bg-stone-50">
              <td className="px-3">
                <span className="flex min-w-0 items-center gap-2">
                  <a
                    href={`/app/decks/${deck.slug}`}
                    dir="auto"
                    className="min-w-0 truncate font-medium text-stone-900 hover:underline"
                  >
                    {deck.title}
                  </a>
                  {deck.visibility === "public" && <Badge variant="lime">Public</Badge>}
                </span>
              </td>

              <td className="px-3 text-stone-600">{`${deck.termLang} → ${deck.meaningLang}`}</td>

              <td className="px-3 text-right tabular-nums text-stone-900">{deck.dueCount}</td>

              <td className="px-3 text-right tabular-nums text-stone-900">{deck.wordCount}</td>

              <td className="px-3">
                <span className="flex items-center justify-end gap-2">
                  {deck.wordCount > 0 ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      href={`/app/decks/${deck.slug}/study`}
                      aria-label={`Study ${deck.title}`}
                    >
                      Study
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" disabled aria-label={`Study ${deck.title}`}>
                      Study
                    </Button>
                  )}

                  <Menu
                    label={`Actions for ${deck.title}`}
                    items={[
                      { label: "Edit deck", onSelect: () => onEdit(deck) },
                      { label: "Delete deck", danger: true, onSelect: () => onDelete(deck) },
                    ]}
                  />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
