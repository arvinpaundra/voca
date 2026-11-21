import { useCallback, useEffect, useState } from "react";
import { Result } from "effect";
import { Plus } from "lucide-react";
import type { DeckSlug, DeckSummary, SnoozeDays } from "@voca/contract";
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
import { SelectionBar } from "./SelectionBar";
import { SnoozeModal } from "./SnoozeModal";
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
  const [timezone, setTimezone] = useState("UTC");
  // Checkboxes stay hidden until the Learner asks to pick decks.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<DeckSlug>>(new Set());
  const [snoozing, setSnoozing] = useState(false);
  const [snoozeBusy, setSnoozeBusy] = useState(false);
  const [snoozeError, setSnoozeError] = useState<string | null>(null);

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

  // A snooze's end is shown on the Learner's day, so the list needs their timezone.
  useEffect(() => {
    let active = true;

    void session.call((client) => client.me.get()).then((result) => {
      if (active && Result.isSuccess(result)) setTimezone(result.success.settings.timezone);
    });

    return () => {
      active = false;
    };
  }, []);

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
    void loadDecks();
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
    void loadDecks();
  };

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
          <>
            <Button
              variant="secondary"
              onClick={selecting ? stopSelecting : () => setSelecting(true)}
            >
              {selecting ? "Done" : "Select"}
            </Button>

            <Button onClick={() => setForm({ kind: "create" })}>
              <Plus className="i" aria-hidden="true" />
              New deck
            </Button>
          </>
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

      {selecting && selected.size > 0 && (
        <SelectionBar
          count={selected.size}
          onSnooze={() => setSnoozing(true)}
          onUnsnooze={() => void unsnoozeSelected()}
          onClear={clearSelection}
        />
      )}

      {snoozeError !== null && <ErrorState message={snoozeError} />}

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

      <DeleteDeckModal
        deck={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={deleted}
      />
    </>
  );
}
