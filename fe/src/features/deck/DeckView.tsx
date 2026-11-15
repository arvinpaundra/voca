import { useEffect, useState, type FormEvent } from "react";
import { DateTime, Result } from "effect";
import type { Deck, DeckStats, Word, WordWithCards } from "@voca/contract";
import { wordLabels } from "@voca/contract";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { cx } from "../../components/cx";
import { session } from "../../lib/appSession";
import { DeckModal } from "../decks/DeckModal";
import { Modal } from "../decks/Modal";
import { matchesWordFilter, type WordFilter } from "./wordFilter";
import { WordItem } from "./WordItem";
import { WordModal } from "./WordModal";

type DeckViewProps = {
  deck: Deck;
  onDeckChanged: (deck: Deck) => void;
};

type WordEditor = { kind: "add" } | { kind: "edit"; word: WordWithCards } | null;

// The search box fills `q` only when it has text, so an empty search lists every word.
const searchQuery = (query: string) => (query === "" ? {} : { q: query });

const filterLabels: readonly { value: WordFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "due", label: "Due" },
  { value: "new", label: "New" },
  { value: "hard", label: "Hard" }
];

const tabClass = (active: boolean) =>
  cx(
    "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
    active ? "border-navy text-navy" : "border-transparent text-stone-500 hover:text-stone-900"
  );

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
  const [editingDeck, setEditingDeck] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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

    session
      .call((client) => client.insight.deckStats({ params: { deckSlug: deck.slug } }))
      .then((result) => {
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
      client.library.listWords({ params: { deckSlug: deck.slug }, query: { ...searchQuery(query), cursor } })
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
          : previous.map((word) => (word.slug === saved.slug ? { ...word, ...saved } : word))
      );
    } else {
      setReloadKey((key) => key + 1);
      setStatsVersion((version) => version + 1);
    }
    setWordEditor(null);
  };

  const deleteWord = (slug: string) => {
    setWords((previous) => (previous === null ? previous : previous.filter((word) => word.slug !== slug)));
    setStatsVersion((version) => version + 1);
  };

  const removeDeck = async () => {
    setDeleteBusy(true);
    setDeleteError(null);

    const result = await session.call((client) => client.library.deleteDeck({ params: { deckSlug: deck.slug } }));

    setDeleteBusy(false);
    if (Result.isSuccess(result)) {
      window.location.assign("/app/decks");
      return;
    }
    setDeleteError("Could not delete the deck. Try again.");
  };

  const toggleVisibility = async () => {
    const isPublic = deck.visibility === "public";

    setVisibilityBusy(true);
    setVisibilityError(null);

    const result = await session.call((client) =>
      isPublic
        ? client.library.unpublishDeck({ params: { deckSlug: deck.slug } })
        : client.library.publishDeck({ params: { deckSlug: deck.slug } })
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

  const total = stats === null ? 0 : stats.maturity.new + stats.maturity.learning + stats.maturity.mature;

  return (
    <section className="grid gap-6">
      <header className="grid gap-2">
        <a className="justify-self-start text-sm text-stone-500 no-underline hover:text-stone-900" href="/app/decks">
          ← Decks
        </a>
        <h1 className="font-montserrat text-3xl font-semibold text-stone-900 break-words" dir="auto">
          {deck.title}
        </h1>
        <p className="text-sm text-stone-500" lang={deck.meaningLang}>
          {deck.termLang} → {deck.meaningLang}
        </p>
        {deck.description !== "" && (
          <p className="text-stone-700" dir="auto">
            {deck.description}
          </p>
        )}
        {deck.visibility === "public" && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
            <Badge variant="lime">Public</Badge>
            {deck.forkCount} forks
          </p>
        )}
        {deck.forkedFrom !== null &&
          (deck.forkedFrom.deleted ? (
            <p className="text-sm text-stone-500">Forked from {deck.forkedFrom.title} (deleted)</p>
          ) : (
            <p className="text-sm text-stone-500">
              Forked from{" "}
              <a className="text-navy underline" href={`/app/discover/${deck.forkedFrom.slug}`} dir="auto">
                {deck.forkedFrom.title}
              </a>
            </p>
          ))}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="accent" href={`/app/decks/${deck.slug}/study`}>
            Study
          </Button>
          <Button variant="ghost" disabled={visibilityBusy} onClick={() => void toggleVisibility()}>
            {deck.visibility === "public" ? "Unpublish" : "Publish"}
          </Button>
          <Button variant="ghost" onClick={() => setEditingDeck(true)}>
            Edit
          </Button>
          <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>
            Delete
          </Button>
        </div>
        {visibilityError !== null && (
          <p className="text-sm text-red-600" role="alert">
            {visibilityError}
          </p>
        )}
      </header>

      {stats !== null && (
        <section className="grid gap-3 rounded-card border border-stone-200 bg-white p-5 shadow-sm" aria-label="Deck progress">
          <div
            className="flex h-3 overflow-hidden rounded-full bg-stone-100"
            role="img"
            aria-label={`New ${stats.maturity.new}, learning ${stats.maturity.learning}, mature ${stats.maturity.mature}`}
          >
            <span className="bg-stone-300" style={{ flexGrow: stats.maturity.new }} />
            <span className="bg-amber-300" style={{ flexGrow: stats.maturity.learning }} />
            <span className="bg-navy" style={{ flexGrow: stats.maturity.mature }} />
          </div>
          <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-sm text-stone-600">
            <li>New {stats.maturity.new}</li>
            <li>Learning {stats.maturity.learning}</li>
            <li>Mature {stats.maturity.mature}</li>
            <li>Due today {stats.dueToday}</li>
            <li className="text-stone-400">{total} words</li>
          </ul>
        </section>
      )}

      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <form className="flex min-w-0 flex-1 gap-2" role="search" onSubmit={search}>
            <input
              className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 hover:border-stone-400 focus:outline-none focus:ring-2 focus:ring-lime/60"
              type="search"
              dir="auto"
              aria-label="Search words"
              placeholder="Search words"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <Button type="submit" variant="ghost">
              Search
            </Button>
          </form>
          <Button variant="primary" onClick={() => setWordEditor({ kind: "add" })}>
            Add word
          </Button>
        </div>

        <div className="flex gap-1 border-b border-stone-200" role="group" aria-label="Filter words">
          {filterLabels.map((option) => (
            <button
              key={option.value}
              type="button"
              className={tabClass(filter === option.value)}
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loadError !== null && (
        <p className="text-sm text-red-600" role="alert">
          {loadError}
        </p>
      )}

      {shown === null ? (
        <p className="text-sm text-stone-500">Loading words…</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {shown.map((word) => (
            <li key={word.slug}>
              <WordItem
                deck={deck}
                word={word}
                onEdit={() => setWordEditor({ kind: "edit", word })}
                onDeleted={deleteWord}
              />
            </li>
          ))}
        </ul>
      )}

      {shown !== null && shown.length === 0 && (
        <p className="text-sm text-stone-500">
          {query === "" && filter === "all" ? "No words yet." : "No words match this view."}
        </p>
      )}

      {nextCursor !== null && (
        <Button variant="ghost" disabled={loadingMore} onClick={() => void loadMore()}>
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      )}

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

      <Modal open={confirmingDelete} title="Delete this deck?" onClose={() => setConfirmingDelete(false)}>
        <div className="grid gap-4 p-6">
          <p className="text-sm text-stone-600">The deck and all of its words will be removed.</p>
          {deleteError !== null && (
            <p className="text-sm text-red-600" role="alert">
              {deleteError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              Keep
            </Button>
            <Button variant="danger" disabled={deleteBusy} onClick={() => void removeDeck()}>
              {deleteBusy ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
