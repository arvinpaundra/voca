import { useEffect, useState, type FormEvent } from "react";
import { DateTime, Result } from "effect";
import type { Deck, DeckStats, Word, WordWithCards } from "@voca/contract";
import { wordLabels } from "@voca/contract";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Input } from "../../components/Input";
import { Menu } from "../../components/Menu";
import { PageHeader } from "../../components/PageHeader";
import { SegmentedControl } from "../../components/SegmentedControl";
import { Skeleton } from "../../components/Skeleton";
import { session } from "../../lib/appSession";
import { DeckModal } from "../decks/DeckModal";
import { DeleteDeckModal } from "../decks/DeleteDeckModal";
import { DeckProgress } from "./DeckProgress";
import { DeleteWordModal } from "./DeleteWordModal";
import { matchesWordFilter, type WordFilter } from "./wordFilter";
import { WordModal } from "./WordModal";
import { WordTable } from "./WordTable";

type DeckViewProps = {
  deck: Deck;
  onDeckChanged: (deck: Deck) => void;
};

type WordEditor = { kind: "add" } | { kind: "edit"; word: WordWithCards } | null;

// The search box fills `q` only when it has text, so an empty search lists every word.
const searchQuery = (query: string) => (query === "" ? {} : { q: query });

const filterOptions: readonly { value: WordFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "due", label: "Due" },
  { value: "new", label: "New" },
  { value: "hard", label: "Hard" },
];

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

  const [wordEditor, setWordEditor] = useState<WordEditor>(null);
  const [deletingWord, setDeletingWord] = useState<WordWithCards | null>(null);
  const [editingDeck, setEditingDeck] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);

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

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuery(searchInput.trim());
  };

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
    }
    setWordEditor(null);
  };

  const wordDeleted = (slug: string) => {
    setWords((previous) => (previous === null ? previous : previous.filter((word) => word.slug !== slug)));
    setStatsVersion((version) => version + 1);
    setDeletingWord(null);
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

  const now = DateTime.nowUnsafe();
  const shown = words?.filter((word) => matchesWordFilter(word, filter, now)) ?? null;
  const unfiltered = query === "" && filter === "all";

  const languages = `${deck.termLang} → ${deck.meaningLang}`;
  const visibility = deck.visibility === "public" ? " · Public" : "";

  return (
    <section>
      <a className="mb-4 inline-block text-sm text-stone-500 no-underline hover:text-stone-900" href="/app/decks">
        ← Decks
      </a>

      <PageHeader
        title={deck.title}
        description={`${languages}${visibility}`}
        actions={
          <>
            <Button href={`/app/decks/${deck.slug}/study`}>Study</Button>
            <Menu
              label="Deck actions"
              items={[
                {
                  label: deck.visibility === "public" ? "Unpublish" : "Publish",
                  onSelect: () => void toggleVisibility(),
                },
                { label: "Edit deck", onSelect: () => setEditingDeck(true) },
                { label: "Delete deck", danger: true, onSelect: () => setConfirmingDelete(true) },
              ]}
            />
          </>
        }
      />

      <div className="grid gap-8">
        {(deck.description !== "" || deck.visibility === "public" || deck.forkedFrom !== null) && (
          <div className="grid gap-2 text-sm text-stone-600">
            {deck.description !== "" && <p dir="auto">{deck.description}</p>}

            {deck.visibility === "public" && <p className="text-stone-500">{deck.forkCount} forks</p>}

            {deck.forkedFrom !== null &&
              (deck.forkedFrom.deleted ? (
                <p className="text-stone-500">Forked from {deck.forkedFrom.title} (deleted)</p>
              ) : (
                <p className="text-stone-500">
                  Forked from{" "}
                  <a className="text-navy underline" href={`/app/discover/${deck.forkedFrom.slug}`} dir="auto">
                    {deck.forkedFrom.title}
                  </a>
                </p>
              ))}
          </div>
        )}

        {visibilityError !== null && (
          <p className="text-sm text-red-600" role="alert">
            {visibilityError}
          </p>
        )}

        {stats !== null && <DeckProgress stats={stats} />}

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <form className="min-w-0 flex-1" role="search" onSubmit={search}>
              <Input
                type="search"
                dir="auto"
                aria-label="Search words"
                placeholder="Search words"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </form>

            <Button variant="secondary" onClick={() => setWordEditor({ kind: "add" })}>
              Add word
            </Button>
          </div>

          <SegmentedControl label="Filter words" options={filterOptions} value={filter} onChange={setFilter} />

          {loadError !== null && <ErrorState message={loadError} onRetry={() => setReloadKey((key) => key + 1)} />}

          {shown === null && loadError === null && <Skeleton label="Loading words" rows={4} />}

          {shown !== null && shown.length > 0 && (
            <WordTable
              deck={deck}
              words={shown}
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
            <div className="flex justify-center">
              <Button variant="ghost" disabled={loadingMore} onClick={() => void loadMore()}>
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </div>
      </div>

      <WordModal
        open={wordEditor !== null}
        deck={deck}
        labels={labels}
        word={wordEditor?.kind === "edit" ? wordEditor.word : undefined}
        onClose={() => setWordEditor(null)}
        onSaved={wordSaved}
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

      <DeleteDeckModal
        deck={confirmingDelete ? deck : null}
        onClose={() => setConfirmingDelete(false)}
        onDeleted={() => window.location.assign("/app/decks")}
      />
    </section>
  );
}
