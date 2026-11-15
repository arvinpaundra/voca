import { useState } from "react";
import { Result } from "effect";
import type { Deck, WordWithCards } from "@voca/contract";
import { Button } from "../../components/Button";
import { session } from "../../lib/appSession";

type WordItemProps = {
  deck: Deck;
  word: WordWithCards;
  onEdit: () => void;
  onDeleted: (slug: string) => void;
};

export function WordItem({ deck, word, onEdit, onDeleted }: WordItemProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);

    const result = await session.call((client) => client.library.deleteWord({ params: { wordSlug: word.slug } }));

    setBusy(false);
    if (Result.isSuccess(result)) {
      onDeleted(word.slug);
      return;
    }
    setConfirming(false);
    setError("Could not delete the word. Try again.");
  };

  return (
    <article className="flex flex-col gap-3 rounded-card border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {word.reading === null ? (
          <span className="font-montserrat text-xl font-semibold text-stone-900" lang={deck.termLang} dir="auto">
            {word.term}
          </span>
        ) : (
          <ruby className="font-montserrat text-xl font-semibold text-stone-900" lang={deck.termLang} dir="auto">
            {word.term}
            <rt className="text-xs font-normal text-stone-500">{word.reading}</rt>
          </ruby>
        )}
        <p className="text-stone-700" lang={deck.meaningLang} dir="auto">
          {word.meaning}
        </p>
      </div>

      {word.example !== null && (
        <p className="text-sm italic text-stone-500" dir="auto">
          {word.example}
        </p>
      )}
      {word.notes !== null && (
        <p className="text-sm text-stone-500" dir="auto">
          {word.notes}
        </p>
      )}
      {error !== null && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-stone-500">Delete this word?</span>
          <Button variant="danger" size="sm" disabled={busy} onClick={() => void remove()}>
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Keep
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        </div>
      )}
    </article>
  );
}
