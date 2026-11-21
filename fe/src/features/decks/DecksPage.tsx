import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Result } from "effect";
import { Plus, Upload } from "lucide-react";
import type { DeckSlug, DeckSummary, SnoozeDays } from "@voca/contract";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { PageHeader } from "../../components/PageHeader";
import { SearchInput } from "../../components/SearchInput";
import { Select } from "../../components/Select";
import { Skeleton } from "../../components/Skeleton";
import { session } from "../../lib/appSession";
import { decksQuery, meQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { DeckModal } from "./DeckModal";
import { DeckRows } from "./DeckRows";
import { ImportDecksModal } from "./ImportDecksModal";
import { DeleteDeckModal } from "./DeleteDeckModal";
import { DeleteDecksModal } from "./DeleteDecksModal";
import { SelectionBar } from "./SelectionBar";
import { SnoozeModal } from "./SnoozeModal";
import {
  filterDecks,
  termLangsOf,
  type DeckFilter,
  type DeckSort,
} from "./deckList";

type FormTarget = { kind: "create" } | { kind: "edit"; deck: DeckSummary };

const sortOptions: readonly { value: DeckSort; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "title", label: "A–Z" },
  { value: "words", label: "Most words" },
  { value: "due", label: "Most due" },
];

const initialFilter: DeckFilter = { q: "", termLang: null, sort: "due" };

export function DecksPage() {
  // The whole list is read once and kept in the cache; search, the language filter and sorting happen in the browser.
  const decksResult = useQuery(decksQuery(), queryClient);
  // A snooze's end is shown on the Learner's day, so the list needs their timezone.
  const meResult = useQuery(meQuery(), queryClient);
  const [filter, setFilter] = useState<DeckFilter>(initialFilter);
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
  const decks = decksResult.data ?? [];
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
          <>
            <Button
              variant="secondary"
              onClick={selecting ? stopSelecting : () => setSelecting(true)}
            >
              {selecting ? "Done" : "Select"}
            </Button>

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

      {loaded && decks.length > 0 && (
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

      {decksResult.isPending && <Skeleton label="Loading decks" rows={4} />}

      {decksResult.isError && (
        <ErrorState message="Could not load your decks." onRetry={retry} />
      )}

      {loaded && decks.length === 0 && (
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

      {loaded && decks.length > 0 && visible.length === 0 && (
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

      {visible.length > 0 && (
        <DeckRows
          decks={visible}
          timezone={timezone}
          {...(selecting && {
            selected,
            onToggleSelect: toggleSelect,
          })}
          onEdit={(deck) => setForm({ kind: "edit", deck })}
          onDelete={(deck) => setDeleting(deck)}
        />
      )}

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
