import { useEffect, useRef, useState } from "react";
import { EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import type { DeckSummary } from "@voca/contract";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { cx } from "../../components/cx";

type DeckCardProps = {
  deck: DeckSummary;
  onEdit: () => void;
  onDelete: () => void;
};

export function DeckCard({ deck, onEdit, onDelete }: DeckCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasWords = deck.wordCount > 0;

  // The menu closes on any click outside it; clicks inside (including the toggle) are left to the menu.
  useEffect(() => {
    if (!menuOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuRef.current !== null && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("click", closeOnOutsideClick);
    return () => document.removeEventListener("click", closeOnOutsideClick);
  }, [menuOpen]);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-stone-100 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.07)]">
      <div className={cx("h-[3px] w-full", deck.dueCount > 0 ? "bg-lime" : "bg-stone-100")} />

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <a
            href={`/app/decks/${deck.slug}`}
            dir="auto"
            className="line-clamp-2 min-w-0 flex-1 text-base font-semibold leading-snug text-stone-900 hover:underline"
          >
            {deck.title}
          </a>

          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              aria-label={`Actions for ${deck.title}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title="More actions"
              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <EllipsisVertical className="size-4" aria-hidden="true" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-100"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                  Edit deck
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Delete deck
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">
            {deck.termLang} → {deck.meaningLang}
          </Badge>
          {deck.visibility === "public" && <Badge variant="lime">Public</Badge>}
        </div>

        <p className="text-sm text-stone-500">
          {deck.wordCount} words · {deck.dueCount} due
        </p>

        <div className="mt-auto flex justify-end pt-1">
          {hasWords ? (
            <Button variant="accent" size="sm" href={`/app/decks/${deck.slug}/study`}>
              Study
            </Button>
          ) : (
            <Button variant="accent" size="sm" disabled>
              Study
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
