import { useCallback, useEffect, useState } from "react";
import { Result } from "effect";
import { Plus } from "lucide-react";
import type { DeckSummary } from "@voca/contract";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { PageHeader } from "../../components/PageHeader";
import { SearchInput } from "../../components/SearchInput";
import { Select } from "../../components/Select";
import { Skeleton } from "../../components/Skeleton";
import { session } from "../../lib/appSession";
import { DeckModal } from "./DeckModal";
import { DeckRows } from "./DeckRows";
import { DeleteDeckModal } from "./DeleteDeckModal";
import {
  filterDecks,
  termLangsOf,
  type DeckFilter,
  type DeckSort,
} from "./deckList";

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

const initialFilter: DeckFilter = { q: "", termLang: null, sort: "due" };

export function DecksPage() {
  const [state, setState] = useState<DeckListState>({ kind: "loading" });
  const [filter, setFilter] = useState<DeckFilter>(initialFilter);
  const [form, setForm] = useState<FormTarget | null>(null);
  const [deleting, setDeleting] = useState<DeckSummary | null>(null);

  // The whole list is loaded once; search, the language filter and sorting happen in the browser.
  const loadDecks = useCallback(async () => {
    const result = await session.call((client) => client.library.listDecks());
    setState(
      Result.isSuccess(result)
        ? { kind: "loaded", decks: result.success }
        : { kind: "failed" },
    );
  }, []);

  useEffect(() => {
    void loadDecks();
  }, [loadDecks]);

  const decks = state.kind === "loaded" ? state.decks : [];
  const langs = termLangsOf(decks);
  const visible = filterDecks(decks, filter);
  const dueToday = decks.reduce((sum, deck) => sum + deck.dueCount, 0);
  const words = decks.reduce((sum, deck) => sum + deck.wordCount, 0);

  const changeLang = (value: string) => {
    setFilter((previous) => ({
      ...previous,
      termLang: value === "" ? null : value,
    }));
  };

  const changeSort = (value: string) => {
    setFilter((previous) => ({ ...previous, sort: value as DeckSort }));
  };

  const changeSearch = (q: string) => {
    setFilter((previous) => ({ ...previous, q }));
  };

  const clearFilter = () =>
    setFilter((previous) => ({ ...previous, q: "", termLang: null }));

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
        {...(state.kind === "loaded" && {
          meta: (
            <>
              <span>{decks.length} decks</span>
              <span className="dot"></span>
              <span>{words} words</span>
              <span className="dot"></span>
              <span>{dueToday} due today</span>
            </>
          ),
        })}
        actions={
          <Button onClick={() => setForm({ kind: "create" })}>
            <Plus className="i" aria-hidden="true" />
            New deck
          </Button>
        }
      />

      {state.kind === "loaded" && decks.length > 0 && (
        <div className="toolbar">
          <SearchInput
            label="Search decks"
            placeholder="Search decks"
            value={filter.q}
            onChange={changeSearch}
          />

          <Select
            label="Term language"
            value={filter.termLang ?? ""}
            options={[
              { value: "", label: "All languages" },
              ...langs.map((lang) => ({ value: lang, label: lang })),
            ]}
            onChange={changeLang}
          />

          <Select
            label="Sort"
            value={filter.sort}
            options={sortOptions}
            onChange={changeSort}
          />
        </div>
      )}

      {state.kind === "loading" && <Skeleton label="Loading decks" rows={4} />}

      {state.kind === "failed" && (
        <ErrorState message="Could not load your decks." onRetry={retry} />
      )}

      {state.kind === "loaded" && decks.length === 0 && (
        <EmptyState
          title="No decks yet"
          body="Create your first deck to start building your vocabulary."
          action={
            <Button
              variant="secondary"
              onClick={() => setForm({ kind: "create" })}
            >
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
        <DeckRows
          decks={visible}
          onEdit={(deck) => setForm({ kind: "edit", deck })}
          onDelete={(deck) => setDeleting(deck)}
        />
      )}

      <DeckModal
        open={form !== null}
        deck={form?.kind === "edit" ? form.deck : undefined}
        onClose={() => setForm(null)}
        onSaved={saved}
      />

      <DeleteDeckModal
        deck={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={deleted}
      />
    </>
  );
}
