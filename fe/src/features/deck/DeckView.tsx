import { useEffect, useState } from "react";
import { DateTime, Result } from "effect";
import type { DeckDetail, DeckStats, ImportResult, SnoozeDays, Word, WordWithCards } from "@voca/contract";
import { wordLabels } from "@voca/contract";
import { ArrowRight, Plus } from "lucide-react";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Menu } from "../../components/Menu";
import { PageHeader } from "../../components/PageHeader";
import { SearchInput } from "../../components/SearchInput";
import { Skeleton } from "../../components/Skeleton";
import { Tabs } from "../../components/Tabs";
import { session } from "../../lib/appSession";
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
import { WordModal } from "./WordModal";
import { WordList } from "./WordList";

type DeckViewProps = {
  deck: DeckDetail;
  onDeckChanged: (deck: DeckDetail) => void;
};

type WordEditor = { kind: "add" } | { kind: "edit"; word: WordWithCards } | null;

// The search box fills `q` only when it has text, so an empty search lists every word.
const searchQuery = (query: string) => (query === "" ? {} : { q: query });

export function DeckView({ deck, onDeckChanged }: DeckViewProps) {
  const labels = wordLabels(deck.termLang);

  const [words, setWords] = useState<readonly WordWithCards[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<WordFilter>("all");

  // The stats bar reloads whenever a word is added or removed, not only when the search changes.
  const [stats, setStats] = useState<DeckStats | null>(null);
  const [statsVersion, setStatsVersion] = useState(0);
  const [wordDelta, setWordDelta] = useState(0);

  const [wordEditor, setWordEditor] = useState<WordEditor>(null);
  const [deletingWord, setDeletingWord] = useState<WordWithCards | null>(null);
  const [editingDeck, setEditingDeck] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("UTC");
  const [snoozing, setSnoozing] = useState(false);
  const [snoozeBusy, setSnoozeBusy] = useState(false);
  const [snoozeError, setSnoozeError] = useState<string | null>(null);

  // The snooze's end is shown on the Learner's day, so the header needs their timezone.
  useEffect(() => {
    let active = true;

    void session.call((client) => client.me.get()).then((result) => {
      if (active && Result.isSuccess(result)) setTimezone(result.success.settings.timezone);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoadError(null);

    session
      .call((client) => client.library.listWords({ params: { deckSlug: deck.slug }, query: searchQuery(query) }))
      .then((result) => {
        if (!active) return;
        if (Result.isSuccess(result)) {
          setWords(result.success.items);
          setNextCursor(result.success.nextCursor);
        } else {
          setLoadError("Could not load the words.");
        }
      });

    return () => {
      active = false;
    };
  }, [deck.slug, query, reloadKey]);

  // The stats endpoint can fail while the insight data is unavailable; the page works without the bar.
  useEffect(() => {
    let active = true;
    setStats(null);

    session.call((client) => client.insight.deckStats({ params: { deckSlug: deck.slug } })).then((result) => {
      if (active && Result.isSuccess(result)) setStats(result.success);
    });

    return () => {
      active = false;
    };
  }, [deck.slug, statsVersion]);

  // The words are searched on the server, so typing waits a moment before asking.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), 250);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadMore = async () => {
    if (nextCursor === null || loadingMore) return;

    const cursor = nextCursor;
    setLoadingMore(true);

    const result = await session.call((client) =>
      client.library.listWords({ params: { deckSlug: deck.slug }, query: { ...searchQuery(query), cursor } }),
    );

    setLoadingMore(false);
    if (Result.isSuccess(result)) {
      setWords((previous) => [...(previous ?? []), ...result.success.items]);
      setNextCursor(result.success.nextCursor);
    } else {
      setLoadError("Could not load more words.");
    }
  };

  const wordSaved = (saved: Word) => {
    if (wordEditor?.kind === "edit") {
      setWords((previous) =>
        previous === null
          ? previous
          : previous.map((word) => (word.slug === saved.slug ? { ...word, ...saved } : word)),
      );
    } else {
      setReloadKey((key) => key + 1);
      setStatsVersion((version) => version + 1);
      setWordDelta((delta) => delta + 1);
    }
    setWordEditor(null);
  };

  const wordDeleted = (slug: string) => {
    setWords((previous) => (previous === null ? previous : previous.filter((word) => word.slug !== slug)));
    setStatsVersion((version) => version + 1);
    setWordDelta((delta) => delta - 1);
    setDeletingWord(null);
  };

  // The server answers with the deck's snooze after the change, so the header shows what was saved.
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
    const [changed] = result.success;
    if (changed !== undefined) onDeckChanged({ ...deck, ...changed });
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

    const [changed] = result.success;
    if (changed !== undefined) onDeckChanged({ ...deck, ...changed });
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
      onDeckChanged(result.success);
      return;
    }
    setVisibilityError(isPublic ? "Could not unpublish the deck. Try again." : "Could not publish the deck. Try again.");
  };

  // Imported words change the word list and the counts, so the same reloads a single add or delete triggers run here.
  // The dialog stays open so its summary stays visible until the user closes it.
  const wordsImported = (result: ImportResult) => {
    setReloadKey((key) => key + 1);
    setStatsVersion((version) => version + 1);
    setWordDelta((delta) => delta + result.imported);
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

  // The deck's word count was read with the deck, so words added or removed since are applied on top.
  const counted = { ...deck, ...(deck.wordCount !== undefined && { wordCount: deck.wordCount + wordDelta }) };
  const { tabs: filterTabs, searchPlaceholder } = deckCounts(counted, stats);
  const snoozeText = snoozeLabel(deck.snooze, timezone);

  return (
    <>
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

      {loadError !== null && <ErrorState message={loadError} onRetry={() => setReloadKey((key) => key + 1)} />}

      {shown === null && loadError === null && <Skeleton label="Loading words" rows={4} />}

      {shown !== null && shown.length > 0 && (
        <WordList
          deck={deck}
          words={shown}
          now={now}
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

      {nextCursor !== null && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Button variant="ghost" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}

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
        onImported={wordsImported}
      />

      <DeckModal
        open={editingDeck}
        deck={deck}
        onClose={() => setEditingDeck(false)}
        onSaved={(saved) => {
          setEditingDeck(false);
          onDeckChanged(saved);
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
