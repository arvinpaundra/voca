import type { PublicDeck } from "@voca/contract";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";

export function PublicDeckTable({
  decks,
  forking,
  onFork,
}: {
  decks: readonly PublicDeck[];
  forking: string | null;
  onFork: (deck: PublicDeck) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-stone-200 bg-white">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <caption className="sr-only">Community decks</caption>

        <thead>
          <tr className="h-8 border-b border-stone-200 text-[11px] font-semibold tracking-[0.06em] text-stone-500 uppercase">
            <th scope="col" className="px-4 text-left font-semibold">
              Deck
            </th>
            <th scope="col" className="px-4 text-left font-semibold">
              Owner
            </th>
            <th scope="col" className="px-4 text-left font-semibold">
              Language
            </th>
            <th scope="col" className="px-4 text-right font-semibold">
              Words
            </th>
            <th scope="col" className="px-4 text-right font-semibold">
              Forks
            </th>
            <th scope="col" className="px-4 text-right font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {decks.map((deck) => (
            <tr key={deck.slug} className="h-11 border-b border-stone-100 last:border-b-0 hover:bg-stone-50">
              <td className="px-4">
                <a
                  href={`/app/discover/${deck.slug}`}
                  dir="auto"
                  className="font-medium text-stone-900 no-underline hover:underline"
                >
                  {deck.title}
                </a>
              </td>

              <td className="px-4">
                <div className="flex min-w-0 items-center gap-2 text-stone-600">
                  <Avatar name={deck.owner.name} src={deck.owner.avatarUrl} size="sm" />
                  <span dir="auto" className="truncate">
                    {deck.owner.name}
                  </span>
                </div>
              </td>

              <td className="px-4 whitespace-nowrap text-stone-600">
                {deck.termLang} → {deck.meaningLang}
              </td>

              <td className="px-4 text-right font-mono tabular-nums text-stone-900">{deck.wordCount}</td>

              <td className="px-4 text-right font-mono tabular-nums text-stone-900">{deck.forkCount}</td>

              <td className="px-4 text-right">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
