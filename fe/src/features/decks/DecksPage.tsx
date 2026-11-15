import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { Result } from "effect";
import { Layers, Plus, Search } from "lucide-react";
import type { DeckSummary } from "@voca/contract";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { session } from "../../lib/appSession";
import { DeckCard } from "./DeckCard";
import { DeckModal } from "./DeckModal";
import { DeleteDeckModal } from "./DeleteDeckModal";
import { filterDecks, termLangsOf, type DeckFilter, type DeckSort } from "./deckList";

type DeckListState =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "loaded"; decks: readonly DeckSummary[] };

type FormTarget = { kind: "create" } | { kind: "edit"; deck: DeckSummary };

const sortOptions: readonly { value: DeckSort; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "title", label: "A–Z" },
  { value: "words", label: "Most words" },
  { value: "due", label: "Most due" }
];

const initialFilter: DeckFilter = { q: "", termLang: null, sort: "recent" };

const selectClass =
  "cursor-pointer rounded-lg border-none bg-transparent text-sm text-stone-600 outline-none focus-visible:ring-2 focus-visible:ring-lime/60";

export function DecksPage() {
  const [state, setState] = useState<DeckListState>({ kind: "loading" });
  const [filter, setFilter] = useState<DeckFilter>(initialFilter);
  const [form, setForm] = useState<FormTarget | null>(null);
  const [deleting, setDeleting] = useState<DeckSummary | null>(null);

  // The whole list is loaded once; search, the language filter and sorting happen in the browser.
  const loadDecks = useCallback(async () => {
    const result = await session.call((client) => client.library.listDecks());
    setState(Result.isSuccess(result) ? { kind: "loaded", decks: result.success } : { kind: "failed" });
  }, []);

  useEffect(() => {
    void loadDecks();
  }, [loadDecks]);

  const decks = state.kind === "loaded" ? state.decks : [];
  const langs = termLangsOf(decks);
  const visible = filterDecks(decks, filter);

  const changeLang = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setFilter((previous) => ({ ...previous, termLang: value === "" ? null : value }));
  };

  const changeSort = (event: ChangeEvent<HTMLSelectElement>) => {
    const sort = event.target.value as DeckSort;
    setFilter((previous) => ({ ...previous, sort }));
  };

  const changeSearch = (event: ChangeEvent<HTMLInputElement>) => {
    const q = event.target.value;
    setFilter((previous) => ({ ...previous, q }));
  };

  const saved = () => {
    setForm(null);
    void loadDecks();
  };

  const deleted = () => {
    setDeleting(null);
    void loadDecks();
  };

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime/20">
            <Layers className="size-5 text-stone-900" aria-hidden="true" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-montserrat text-2xl font-semibold text-stone-900">My Decks</h1>
              {state.kind === "loaded" && <Badge>{decks.length} decks</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-stone-500">Create and manage your vocabulary decks.</p>
          </div>
        </div>

        <Button variant="accent" onClick={() => setForm({ kind: "create" })}>
          <Plus className="size-4" aria-hidden="true" />
          New deck
        </Button>
      </header>

      {state.kind === "loaded" && decks.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 text-stone-500">
            <Search className="size-4 shrink-0 text-stone-400" aria-hidden="true" />
            <input
              type="search"
              dir="auto"
              aria-label="Search decks"
              placeholder="Search decks…"
              value={filter.q}
              onChange={changeSearch}
              className="w-full min-w-0 bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
            />
          </div>

          <div className="h-4 w-px bg-stone-200" />

          <select
            className={selectClass}
            aria-label="Term language"
            value={filter.termLang ?? ""}
            onChange={changeLang}
          >
            <option value="">All languages</option>
            {langs.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>

          <select className={selectClass} aria-label="Sort" value={filter.sort} onChange={changeSort}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <span className="ml-auto shrink-0 text-xs text-stone-400">{visible.length} decks</span>
        </div>
      )}

      {state.kind === "loading" && <p className="text-sm text-stone-500">Loading decks…</p>}

      {state.kind === "failed" && (
        <p role="alert" className="text-sm text-red-600">
          Could not load your decks.
        </p>
      )}

      {state.kind === "loaded" && decks.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <Layers className="size-12 text-stone-200" aria-hidden="true" />
          <p className="text-xl font-semibold text-stone-900">No decks yet</p>
          <p className="max-w-xs text-sm text-stone-400">
            Create your first deck to start building your vocabulary.
          </p>
          <Button variant="primary" onClick={() => setForm({ kind: "create" })}>
            <Plus className="size-4" aria-hidden="true" />
            Create your first deck
          </Button>
        </div>
      )}

      {state.kind === "loaded" && decks.length > 0 && visible.length === 0 && (
        <p className="text-sm text-stone-500">No decks match your search.</p>
      )}

      {visible.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((deck) => (
            <li key={deck.slug}>
              <DeckCard
                deck={deck}
                onEdit={() => setForm({ kind: "edit", deck })}
                onDelete={() => setDeleting(deck)}
              />
            </li>
          ))}
        </ul>
      )}

      <DeckModal
        open={form !== null}
        deck={form?.kind === "edit" ? form.deck : undefined}
        onClose={() => setForm(null)}
        onSaved={saved}
      />

      <DeleteDeckModal deck={deleting} onClose={() => setDeleting(null)} onDeleted={deleted} />
    </div>
  );
}
