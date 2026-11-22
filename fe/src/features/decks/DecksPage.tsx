import { useCallback, useEffect, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Result } from "effect";
import { Plus, Upload } from "lucide-react";
import type { DeckSlug, DeckSummary, SnoozeDays } from "@voca/contract";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadMore } from "../../components/LoadMore";
import { PageHeader } from "../../components/PageHeader";
import { SearchInput } from "../../components/SearchInput";
import { Select } from "../../components/Select";
import { Skeleton } from "../../components/Skeleton";
import { session } from "../../lib/appSession";
import { mergePages } from "../../lib/paging";
import { deckListQuery, meQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { DeckModal } from "./DeckModal";
import { DeckRows } from "./DeckRows";
import { ImportDecksModal } from "./ImportDecksModal";
import { DeleteDeckModal } from "./DeleteDeckModal";
import { DeleteDecksModal } from "./DeleteDecksModal";
import { SelectionBar } from "./SelectionBar";
import { SnoozeModal } from "./SnoozeModal";
import type { DeckSort } from "./deckList";

type FormTarget = { kind: "create" } | { kind: "edit"; deck: DeckSummary };

const sortOptions: readonly { value: DeckSort; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "title", label: "A–Z" },
  { value: "words", label: "Most words" },
  { value: "due", label: "Most due" },
];

// The server searches the titles, so the typed text waits this long before it is sent.
const SEARCH_DELAY_MS = 250;

export function DecksPage() {
  // The search box shows what is typed; the list asks the server for what was typed a moment ago.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  // The language "" is every language.
  const [termLang, setTermLang] = useState("");
  const [sort, setSort] = useState<DeckSort>("due");

  // A new search, language or sort is a new query, so its list starts from the first page. The previous list stays
  // on screen until the new first page arrives, so the search box keeps its place.
  const decksResult = useInfiniteQuery(
    { ...deckListQuery({ q: search, termLang, sort }), placeholderData: keepPreviousData },
    queryClient,
  );
  // A snooze's end is shown on the Learner's day, so the list needs their timezone.
  const meResult = useQuery(meQuery(), queryClient);
  const [form, setForm] = useState<FormTarget | null>(null);
  const [deleting, setDeleting] = useState<DeckSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const timezone = meResult.data?.settings.timezone ?? "UTC";
  // Checkboxes stay hidden until the Learner asks to pick decks.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<DeckSlug>>(new Set());
  const [snoozing, setSnoozing] = useState(false);
  const [snoozeBusy, setSnoozeBusy] = useState(false);
  const [snoozeError, setSnoozeError] = useState<string | null>(null);
  const [deletingSelection, setDeletingSelection] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  // A write refreshes every cached read, so the list shows what the write changed.
  const refreshCache = () => {
    void queryClient.invalidateQueries();
  };

  const toggleSelect = (deck: DeckSummary) => {
    setSelected((previous) => {
      const next = new Set(previous);

      if (next.has(deck.slug)) next.delete(deck.slug);
      else next.add(deck.slug);

      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  // Leaving select mode drops the ticks, so the next time starts from none.
  const stopSelecting = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);

  // A dialog marks its own Escape as handled; that one only closes the dialog.
  useEffect(() => {
    if (!selecting) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (event.defaultPrevented) return;

      stopSelecting();
    };

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [selecting, stopSelecting]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // The snooze endpoints take at least one slug, so an empty selection has nothing to send.
  const selectedSlugs = (): readonly [DeckSlug, ...DeckSlug[]] | null => {
    const [first, ...rest] = [...selected];

    return first === undefined ? null : [first, ...rest];
  };

  const snoozeSelected = async (days: SnoozeDays | null) => {
    const deckSlugs = selectedSlugs();
    if (deckSlugs === null) return;

    setSnoozeBusy(true);
    setSnoozeError(null);

    const result = await session.call((client) => client.library.snoozeDecks({ payload: { deckSlugs, days } }));

    setSnoozeBusy(false);
    if (Result.isFailure(result)) {
      setSnoozeError("Could not snooze the decks. Try again.");
      return;
    }

    setSnoozing(false);
    stopSelecting();
    refreshCache();
  };

  const unsnoozeSelected = async () => {
    const deckSlugs = selectedSlugs();
    if (deckSlugs === null) return;

    setSnoozeError(null);

    const result = await session.call((client) => client.library.unsnoozeDecks({ payload: { deckSlugs } }));

    if (Result.isFailure(result)) {
      setSnoozeError("Could not unsnooze the decks. Try again.");
      return;
    }

    stopSelecting();
    refreshCache();
  };

  const deletedSelection = (failed: number) => {
    setDeletingSelection(false);
    stopSelecting();
    refreshCache();

    if (failed === 0) {
      setDeleteNotice(null);
      return;
    }

    const noun = failed === 1 ? "deck" : "decks";
    setDeleteNotice(`${failed} ${noun} could not be deleted.`);
  };

  const loaded = decksResult.isSuccess;
  const pages = decksResult.data?.pages ?? [];
  const decks = mergePages(pages);
  // The count and the languages cover the whole library, so they come from any page.
  const total = pages[0]?.total ?? 0;
  const termLangs = pages[0]?.termLangs ?? [];

  // Select all picks the decks loaded so far; the rest load later and are not picked by it.
  const selectAll = () => setSelected(new Set(decks.map((deck) => deck.slug)));

  const clearFilter = () => {
    setSearchInput("");
    setSearch("");
    setTermLang("");
  };

  const retry = () => {
    refreshCache();
  };

  const saved = () => {
    setForm(null);
    refreshCache();
  };

  const deleted = () => {
    setDeleting(null);
    refreshCache();
  };

  return (
    <>
      <PageHeader
        title="Decks"
        {...(loaded && {
          meta: <span>{total} decks</span>,
        })}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={selecting ? stopSelecting : () => setSelecting(true)}
            >
              {selecting ? "Done" : "Select"}
            </Button>

            {selecting && decks.length > 0 && (
              <Button variant="secondary" onClick={selectAll}>
                Select all
              </Button>
            )}

            <Button variant="secondary" onClick={() => setImporting(true)}>
              <Upload className="i" aria-hidden="true" />
              Import decks
            </Button>

            <Button onClick={() => setForm({ kind: "create" })}>
              <Plus className="i" aria-hidden="true" />
              New deck
            </Button>
          </>
        }
      />

      {loaded && total > 0 && (
        <div className="toolbar">
          <SearchInput
            label="Search decks"
            placeholder="Search decks"
            value={searchInput}
            onChange={setSearchInput}
          />

          <Select
            label="Term language"
            value={termLang}
            options={[
              { value: "", label: "All languages" },
              ...termLangs.map((lang) => ({ value: lang, label: lang })),
            ]}
            onChange={setTermLang}
          />

          <Select
            label="Sort"
            value={sort}
            options={sortOptions}
            onChange={(value) => setSort(value as DeckSort)}
          />
        </div>
      )}

      {decksResult.isPending && <Skeleton label="Loading decks" rows={4} />}

      {decksResult.isError && (
        <ErrorState message="Could not load your decks." onRetry={retry} />
      )}

      {loaded && total === 0 && (
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

      {loaded && total > 0 && decks.length === 0 && (
        <EmptyState
          title="No decks match your search."
          action={
            <Button variant="secondary" onClick={clearFilter}>
              Clear search
            </Button>
          }
        />
      )}

      {selecting && selected.size > 0 && (
        <SelectionBar
          count={selected.size}
          onSnooze={() => setSnoozing(true)}
          onUnsnooze={() => void unsnoozeSelected()}
          onDelete={() => setDeletingSelection(true)}
          onClear={clearSelection}
        />
      )}

      {snoozeError !== null && <ErrorState message={snoozeError} />}

      {deleteNotice !== null && <ErrorState message={deleteNotice} />}

      {decks.length > 0 && (
        <DeckRows
          decks={decks}
          timezone={timezone}
          {...(selecting && {
            selected,
            onToggleSelect: toggleSelect,
          })}
          onEdit={(deck) => setForm({ kind: "edit", deck })}
          onDelete={(deck) => setDeleting(deck)}
        />
      )}

      <LoadMore
        hasNextPage={decksResult.hasNextPage && !decksResult.isPlaceholderData}
        isFetchingNextPage={decksResult.isFetchingNextPage}
        onLoadMore={() => void decksResult.fetchNextPage()}
      />

      <SnoozeModal
        open={snoozing}
        count={selected.size}
        busy={snoozeBusy}
        onSnooze={(days) => void snoozeSelected(days)}
        onClose={() => setSnoozing(false)}
      />

      <DeckModal
        open={form !== null}
        deck={form?.kind === "edit" ? form.deck : undefined}
        onClose={() => setForm(null)}
        onSaved={saved}
      />

      <DeleteDecksModal
        deckSlugs={deletingSelection ? selectedSlugs() : null}
        onClose={() => setDeletingSelection(false)}
        onDeleted={deletedSelection}
      />

      <ImportDecksModal open={importing} onClose={() => setImporting(false)} />

      <DeleteDeckModal
        deck={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={deleted}
      />
    </>
  );
}
