import { useEffect, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { DateTime, Result } from "effect";
import type { DeckDetail, SnoozeDays, WordWithCards } from "@voca/contract";
import { wordLabels } from "@voca/contract";
import { ArrowRight, Plus } from "lucide-react";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { LoadMore } from "../../components/LoadMore";
import { Menu } from "../../components/Menu";
import { PageHeader } from "../../components/PageHeader";
import { SearchInput } from "../../components/SearchInput";
import { Skeleton } from "../../components/Skeleton";
import { Tabs } from "../../components/Tabs";
import { session } from "../../lib/appSession";
import { mergePages } from "../../lib/paging";
import { deckStatsQuery, meQuery, wordsQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import { DeckModal } from "../decks/DeckModal";
import { DeleteDeckModal } from "../decks/DeleteDeckModal";
import { SnoozeModal } from "../decks/SnoozeModal";
import { snoozeLabel } from "../decks/snooze";
import { CsvImportModal } from "./CsvImportModal";
import { deckCounts } from "./deckCounts";
import { DeckProgress } from "./DeckProgress";
import { DeleteWordModal } from "./DeleteWordModal";
import { exportFileName } from "./csvModel";
import { matchesWordFilter, type WordFilter } from "./wordFilter";
import { WordDetailsModal } from "./WordDetailsModal";
import { WordModal } from "./WordModal";
import { WordList } from "./WordList";

type DeckViewProps = {
  deck: DeckDetail;
};

type WordEditor = { kind: "add" } | { kind: "edit"; word: WordWithCards } | null;

// The search box fills `q` only when it has text, so an empty search lists every word.
const searchQuery = (query: string) => (query === "" ? {} : { q: query });

// Every write refreshes the whole cache: the deck, its stats and its words are read back from the server.
const refreshCache = () => void queryClient.invalidateQueries();

export function DeckView({ deck }: DeckViewProps) {
  const labels = wordLabels(deck.termLang);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<WordFilter>("all");

  // The modal reads the word from the list, so an edit saved there shows in the modal too.
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [wordEditor, setWordEditor] = useState<WordEditor>(null);
  const [deletingWord, setDeletingWord] = useState<WordWithCards | null>(null);
  const [editingDeck, setEditingDeck] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [snoozing, setSnoozing] = useState(false);
  const [snoozeBusy, setSnoozeBusy] = useState(false);
  const [snoozeError, setSnoozeError] = useState<string | null>(null);

  // The snooze's end is shown on the Learner's day, so the header needs their timezone.
  const me = useQuery(meQuery(), queryClient);
  const timezone = me.data?.settings.timezone ?? "UTC";

  // The stats endpoint can fail while the insight data is unavailable; the page works without the bar.
  const statsResult = useQuery(deckStatsQuery(deck.slug), queryClient);
  const stats = statsResult.data ?? null;

  const wordsResult = useInfiniteQuery(wordsQuery(deck.slug, searchQuery(query)), queryClient);
  const words = wordsResult.data === undefined ? null : mergePages(wordsResult.data.pages);
  const loadError = wordsResult.isError
    ? words === null
      ? "Could not load the words."
      : "Could not load more words."
    : null;

  // The words are searched on the server, so typing waits a moment before asking.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), 250);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadMore = () => {
    if (!wordsResult.hasNextPage || wordsResult.isFetchingNextPage) return;

    void wordsResult.fetchNextPage();
  };

  const wordSaved = () => {
    setWordEditor(null);
    refreshCache();
  };

  const wordDeleted = () => {
    setDeletingWord(null);
    setOpenSlug(null);
    refreshCache();
  };

  // The server answers with the deck's snooze after the change; the refreshed deck shows what was saved.
  const snoozeThis = async (days: SnoozeDays | null) => {
    setSnoozeBusy(true);
    setSnoozeError(null);

    const result = await session.call((client) =>
      client.library.snoozeDecks({ payload: { deckSlugs: [deck.slug], days } }),
    );

    setSnoozeBusy(false);
    if (Result.isFailure(result)) {
      setSnoozeError("Could not snooze the deck. Try again.");
      return;
    }

    setSnoozing(false);
    refreshCache();
  };

  const unsnoozeThis = async () => {
    setSnoozeError(null);

    const result = await session.call((client) =>
      client.library.unsnoozeDecks({ payload: { deckSlugs: [deck.slug] } }),
    );

    if (Result.isFailure(result)) {
      setSnoozeError("Could not unsnooze the deck. Try again.");
      return;
    }

    refreshCache();
  };

  const toggleVisibility = async () => {
    const isPublic = deck.visibility === "public";

    setVisibilityBusy(true);
    setVisibilityError(null);

    const result = await session.call((client) =>
      isPublic
        ? client.library.unpublishDeck({ params: { deckSlug: deck.slug } })
        : client.library.publishDeck({ params: { deckSlug: deck.slug } }),
    );

    setVisibilityBusy(false);
    if (Result.isSuccess(result)) {
      refreshCache();
      return;
    }
    setVisibilityError(isPublic ? "Could not unpublish the deck. Try again." : "Could not publish the deck. Try again.");
  };

  const exportDeck = async () => {
    setExportError(null);

    const result = await session.call((client) => client.library.exportCsv({ params: { deckSlug: deck.slug } }));

    if (Result.isFailure(result)) {
      setExportError("Could not export the deck. Try again.");
      return;
    }

    const url = URL.createObjectURL(new Blob([result.success], { type: "text/csv" }));
    const link = document.createElement("a");

    link.href = url;
    link.download = exportFileName(deck.slug);
    link.click();

    // Some browsers cancel the download when the URL is revoked in the same tick as the click.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const now = DateTime.nowUnsafe();
  const shown = words?.filter((word) => matchesWordFilter(word, filter, now)) ?? null;
  const unfiltered = query === "" && filter === "all";

  const { tabs: filterTabs, searchPlaceholder } = deckCounts(deck, stats);
  const snoozeText = snoozeLabel(deck.snooze, timezone);

  const openedWord = words?.find((word) => word.slug === openSlug) ?? null;

  return (
    <>
      <WordDetailsModal
        word={openedWord}
        termLang={deck.termLang}
        meaningLang={deck.meaningLang}
        own={{ deckSlug: deck.slug }}
        onClose={() => setOpenSlug(null)}
      />

      <div className="deck-hero">
        <PageHeader
          back={{ href: "/app/decks", label: "Decks" }}
          title={deck.title}
          meta={
            <>
              <Badge variant="outline" lang>
                {`${deck.termLang} → ${deck.meaningLang}`}
              </Badge>
              {deck.visibility === "public" && <Badge variant="lime">Public</Badge>}
              {snoozeText !== null && <Badge variant="navy">{snoozeText}</Badge>}
              {deck.visibility === "public" && <span>{deck.forkCount} forks</span>}
              {deck.forkedFrom !== null && (
                <>
                  <span className="dot"></span>
                  {deck.forkedFrom.deleted ? (
                    <span>Forked from {deck.forkedFrom.title} (deleted)</span>
                  ) : (
                    <span>
                      Forked from{" "}
                      <a href={`/app/discover/${deck.forkedFrom.slug}`} dir="auto" style={{ color: "var(--navy)" }}>
                        {deck.forkedFrom.title}
                      </a>
                    </span>
                  )}
                </>
              )}
            </>
          }
          {...(deck.description !== "" && { description: deck.description })}
          actions={
            <>
              <Button variant="secondary" href={`/app/decks/${deck.slug}/flashcards`}>
                Flashcards
              </Button>
              <Button href={`/app/decks/${deck.slug}/study`}>
                {stats === null ? "Study" : `Study ${stats.dueToday} due`}
                <ArrowRight className="i" aria-hidden="true" />
              </Button>
              <Menu
                trigger="secondary"
                label="More actions"
                items={[
                  { label: "Edit deck", onSelect: () => setEditingDeck(true) },
                  snoozeText === null
                    ? { label: "Snooze deck", onSelect: () => setSnoozing(true) }
                    : { label: "Unsnooze deck", onSelect: () => void unsnoozeThis() },
                  {
                    label: deck.visibility === "public" ? "Unpublish" : "Publish",
                    onSelect: () => void toggleVisibility(),
                  },
                  { label: "Import CSV", onSelect: () => setImporting(true) },
                  { label: "Export CSV", onSelect: () => void exportDeck() },
                  { label: "Delete deck", danger: true, onSelect: () => setConfirmingDelete(true) },
                ]}
              />
            </>
          }
        />

        {stats !== null && <DeckProgress stats={stats} />}
      </div>

      {visibilityError !== null && <ErrorState message={visibilityError} />}

      {exportError !== null && <ErrorState message={exportError} />}

      {snoozeError !== null && <ErrorState message={snoozeError} />}

      <div className="grid gap-3">
        <div className="toolbar">
          <SearchInput
            label="Search words"
            placeholder={searchPlaceholder}
            value={searchInput}
            onChange={setSearchInput}
          />

          <Button variant="secondary" onClick={() => setWordEditor({ kind: "add" })}>
            <Plus className="i" aria-hidden="true" />
            Add word
          </Button>
        </div>

        <Tabs label="Filter words" tabs={filterTabs} value={filter} onChange={setFilter} />
      </div>

      {loadError !== null && <ErrorState message={loadError} onRetry={() => void wordsResult.refetch()} />}

      {shown === null && loadError === null && <Skeleton label="Loading words" rows={4} />}

      {shown !== null && shown.length > 0 && (
        <WordList
          deck={deck}
          words={shown}
          now={now}
          onOpen={(word) => setOpenSlug(word.slug)}
          onEdit={(word) => setWordEditor({ kind: "edit", word })}
          onDelete={(word) => setDeletingWord(word)}
        />
      )}

      {shown !== null && shown.length === 0 && unfiltered && (
        <EmptyState
          title="No words yet"
          body="Add the first word to this deck."
          action={
            <Button variant="secondary" onClick={() => setWordEditor({ kind: "add" })}>
              Add word
            </Button>
          }
        />
      )}

      {shown !== null && shown.length === 0 && !unfiltered && <EmptyState title="No words match this view." />}

      <LoadMore
        hasNextPage={wordsResult.hasNextPage}
        isFetchingNextPage={wordsResult.isFetchingNextPage}
        onLoadMore={loadMore}
      />

      <WordModal
        open={wordEditor !== null}
        deck={deck}
        labels={labels}
        word={wordEditor?.kind === "edit" ? wordEditor.word : undefined}
        onClose={() => setWordEditor(null)}
        onSaved={wordSaved}
      />

      <CsvImportModal
        open={importing}
        deckSlug={deck.slug}
        onClose={() => setImporting(false)}
        onImported={refreshCache}
      />

      <DeckModal
        open={editingDeck}
        deck={deck}
        onClose={() => setEditingDeck(false)}
        onSaved={() => {
          setEditingDeck(false);
          refreshCache();
        }}
      />

      <DeleteWordModal word={deletingWord} onClose={() => setDeletingWord(null)} onDeleted={wordDeleted} />

      <SnoozeModal
        open={snoozing}
        count={1}
        busy={snoozeBusy}
        onSnooze={(days) => void snoozeThis(days)}
        onClose={() => setSnoozing(false)}
      />

      <DeleteDeckModal
        deck={confirmingDelete ? deck : null}
        onClose={() => setConfirmingDelete(false)}
        onDeleted={() => window.location.assign("/app/decks")}
      />
    </>
  );
}
