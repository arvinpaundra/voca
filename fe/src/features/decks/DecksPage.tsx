import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { Result } from "effect";
import { Plus } from "lucide-react";
import type { DeckSummary } from "@voca/contract";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Input } from "../../components/Input";
import { PageHeader } from "../../components/PageHeader";
import { Skeleton } from "../../components/Skeleton";
import { session } from "../../lib/appSession";
import { DeckModal } from "./DeckModal";
import { DeckTable } from "./DeckTable";
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
  { value: "due", label: "Most due" },
];

const initialFilter: DeckFilter = { q: "", termLang: null, sort: "recent" };

const selectClass =
  "h-8 cursor-pointer rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-900 hover:border-stone-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy";

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
  const dueToday = decks.reduce((sum, deck) => sum + deck.dueCount, 0);

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

  const clearFilter = () => setFilter((previous) => ({ ...previous, q: "", termLang: null }));

  const retry = () => {
    setState({ kind: "loading" });
    void loadDecks();
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
    <>
      <PageHeader
        title="Decks"
        {...(state.kind === "loaded" && { description: `${decks.length} decks · ${dueToday} due today` })}
        actions={
          <Button onClick={() => setForm({ kind: "create" })}>
            <Plus className="size-4" aria-hidden="true" />
            New deck
          </Button>
        }
      />

      <div className="grid gap-8">
        {state.kind === "loaded" && decks.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1 basis-60">
              <Input
                type="search"
                dir="auto"
                aria-label="Search decks"
                placeholder="Search decks"
                value={filter.q}
                onChange={changeSearch}
              />
            </div>

            <select className={selectClass} aria-label="Term language" value={filter.termLang ?? ""} onChange={changeLang}>
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
          </div>
        )}

        {state.kind === "loading" && <Skeleton label="Loading decks" rows={4} />}

        {state.kind === "failed" && <ErrorState message="Could not load your decks." onRetry={retry} />}

        {state.kind === "loaded" && decks.length === 0 && (
          <EmptyState
            title="No decks yet"
            body="Create your first deck to start building your vocabulary."
            action={
              <Button variant="secondary" onClick={() => setForm({ kind: "create" })}>
                Create your first deck
              </Button>
            }
          />
        )}

        {state.kind === "loaded" && decks.length > 0 && visible.length === 0 && (
          <EmptyState
            title="No decks match your search."
            action={
              <Button variant="secondary" onClick={clearFilter}>
                Clear search
              </Button>
            }
          />
        )}

        {visible.length > 0 && (
          <DeckTable
            decks={visible}
            onEdit={(deck) => setForm({ kind: "edit", deck })}
            onDelete={(deck) => setDeleting(deck)}
          />
        )}
      </div>

      <DeckModal
        open={form !== null}
        deck={form?.kind === "edit" ? form.deck : undefined}
        onClose={() => setForm(null)}
        onSaved={saved}
      />

      <DeleteDeckModal deck={deleting} onClose={() => setDeleting(null)} onDeleted={deleted} />
    </>
  );
}
