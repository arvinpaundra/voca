import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { DateTime, Result } from "effect";
import type { Deck, DeckStats, Word, WordWithCards } from "@voca/contract";
import { wordLabels } from "@voca/contract";
import { Button } from "../../components/Button";
import { session } from "../../lib/appSession";
import { DeckModal } from "../decks/DeckModal";
import { Modal } from "../decks/Modal";
import styles from "./deck.module.css";
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
  { value: "all", label: "All words" },
  { value: "due", label: "Due" },
  { value: "new", label: "New" },
  { value: "hard", label: "Hard" }
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
  const [editingDeck, setEditingDeck] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const changeFilter = (event: ChangeEvent<HTMLSelectElement>) => {
    setFilter(event.target.value as WordFilter);
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

  const now = DateTime.nowUnsafe();
  const shown = words?.filter((word) => matchesWordFilter(word, filter, now)) ?? null;

  return (
    <section className={styles.deck}>
      <header className={styles.header}>
        <a className={styles.back} href="/app/decks">
          ← Decks
        </a>
        <h1 className={styles.title} dir="auto">
          {deck.title}
        </h1>
        <p className={styles.note} lang={deck.meaningLang}>
          {deck.termLang} → {deck.meaningLang}
        </p>
        {deck.description !== "" && <p className={styles.body} dir="auto">{deck.description}</p>}
        <div className={styles.actions}>
          <Button variant="accent" href={`/app/decks/${deck.slug}/study`}>
            Study
          </Button>
          <Button variant="ghost" onClick={() => setEditingDeck(true)}>
            Edit
          </Button>
          <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>
            Delete
          </Button>
        </div>
      </header>

      {stats !== null && (
        <section className={styles.stats} aria-label="Deck progress">
          <div
            className={styles.bar}
            role="img"
            aria-label={`New ${stats.maturity.new}, learning ${stats.maturity.learning}, mature ${stats.maturity.mature}`}
          >
            <span className={styles.segNew} style={{ flexGrow: stats.maturity.new }} />
            <span className={styles.segLearning} style={{ flexGrow: stats.maturity.learning }} />
            <span className={styles.segMature} style={{ flexGrow: stats.maturity.mature }} />
          </div>
          <ul className={styles.legend}>
            <li>New {stats.maturity.new}</li>
            <li>Learning {stats.maturity.learning}</li>
            <li>Mature {stats.maturity.mature}</li>
            <li>Due today {stats.dueToday}</li>
          </ul>
        </section>
      )}

      <div className={styles.search}>
        <form className={styles.searchForm} role="search" onSubmit={search}>
          <input
            className={styles.input}
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
        <select className={styles.select} aria-label="Filter words" value={filter} onChange={changeFilter}>
          {filterLabels.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button variant="primary" onClick={() => setWordEditor({ kind: "add" })}>
          Add word
        </Button>
      </div>

      {loadError !== null && <p className={styles.error} role="alert">{loadError}</p>}

      {shown === null ? (
        <p className={styles.note}>Loading words…</p>
      ) : (
        <ul className={styles.words}>
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
        <p className={styles.note}>
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
        <p className={styles.note}>The deck and all of its words will be removed.</p>
        {deleteError !== null && <p className={styles.error} role="alert">{deleteError}</p>}
        <div className={styles.actions}>
          <Button variant="accent" disabled={deleteBusy} onClick={() => void removeDeck()}>
            {deleteBusy ? "Deleting…" : "Delete"}
          </Button>
          <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
            Keep
          </Button>
        </div>
      </Modal>
    </section>
  );
}
