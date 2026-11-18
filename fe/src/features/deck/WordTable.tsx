import type { Deck, WordWithCards } from "@voca/contract";
import { Menu } from "../../components/Menu";

type WordTableProps = {
  deck: Deck;
  words: readonly WordWithCards[];
  onEdit: (word: WordWithCards) => void;
  onDelete: (word: WordWithCards) => void;
};

const headerClass = "h-8 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500";

export function WordTable({ deck, words, onEdit, onDelete }: WordTableProps) {
  return (
    <div className="rounded-card border border-stone-200 bg-white">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Words</caption>

        <thead>
          <tr>
            <th scope="col" className={headerClass}>
              Term
            </th>
            <th scope="col" className={headerClass}>
              Meaning
            </th>
            <th scope="col" className={`${headerClass} w-12 text-right`}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {words.map((word) => (
            <tr key={word.slug} className="h-11 border-t border-stone-200 hover:bg-stone-50">
              <td className="px-3">
                {word.reading === null ? (
                  <span className="font-term text-base text-stone-900" lang={deck.termLang} dir="auto">
                    {word.term}
                  </span>
                ) : (
                  <ruby className="font-term text-base text-stone-900" lang={deck.termLang} dir="auto">
                    {word.term}
                    <rt className="text-xs font-normal text-stone-500">{word.reading}</rt>
                  </ruby>
                )}
              </td>

              <td className="px-3 text-stone-700" lang={deck.meaningLang} dir="auto">
                {word.meaning}
              </td>

              <td className="px-3 text-right">
                <Menu
                  label={`Actions for ${word.term}`}
                  items={[
                    { label: "Edit word", onSelect: () => onEdit(word) },
                    { label: "Delete word", danger: true, onSelect: () => onDelete(word) },
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
