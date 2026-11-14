import { useEffect, useState, type FormEvent } from "react";
import { Result } from "effect";
import type { Deck, Word, WordWithCards } from "@voca/contract";
import { Button } from "../../components/Button";
import { session } from "../../lib/appSession";
import { wordLabels } from "@voca/contract";
import styles from "./deck.module.css";
import { WordForm } from "./WordForm";
import { WordItem } from "./WordItem";
import { createPayload, DUPLICATE_MESSAGE, emptyDraft, failureTag, type WordDraft } from "./wordModel";

type DeckViewProps = {
  deck: Deck;
};

// The search box fills `q` only when it has text, so an empty search lists every word.
const searchQuery = (query: string) => (query === "" ? {} : { q: query });

export function DeckView({ deck }: DeckViewProps) {
  const labels = wordLabels(deck.termLang);

  const [words, setWords] = useState<readonly WordWithCards[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [adding, setAdding] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

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

  const addWord = async (draft: WordDraft) => {
    setAddBusy(true);
    setAddError(null);

    const result = await session.call((client) =>
      client.library.createWord({ params: { deckSlug: deck.slug }, payload: createPayload(draft) })
    );

    setAddBusy(false);
    if (Result.isSuccess(result)) {
      setAdding(false);
      setReloadKey((key) => key + 1);
      return;
    }
    const duplicate = failureTag(result.failure) === "DuplicateWord";
    setAddError(duplicate ? DUPLICATE_MESSAGE : "Could not add the word. Try again.");
  };

  const updateWord = (updated: Word) => {
    setWords((previous) =>
      previous === null
        ? previous
        : previous.map((word) => (word.slug === updated.slug ? { ...word, ...updated } : word))
    );
  };

  const deleteWord = (slug: string) => {
    setWords((previous) =>
      previous === null
        ? previous
        : previous.filter((word) => word.slug !== slug)
    );
  };

  return (
    <section className={styles.deck}>
      <header className={styles.header}>
        <h1 className={styles.title} dir="auto">{deck.title}</h1>
        {deck.description !== "" && <p className={styles.body} dir="auto">{deck.description}</p>}
        <div>
          <Button variant="accent" href={`/app/decks/${deck.slug}/study`}>
            Study
          </Button>
        </div>
      </header>

      <form className={styles.search} role="search" onSubmit={search}>
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

      {loadError !== null && <p className={styles.error} role="alert">{loadError}</p>}

      {words === null ? (
        <p className={styles.note}>Loading words…</p>
      ) : (
        <ul className={styles.words}>
          {words.map((word) => (
            <li key={word.slug}>
              <WordItem
                deck={deck}
                labels={labels}
                word={word}
                onUpdated={updateWord}
                onDeleted={deleteWord}
              />
            </li>
          ))}
        </ul>
      )}

      {words !== null && words.length === 0 && (
        <p className={styles.note}>{query === "" ? "No words yet." : "No words match your search."}</p>
      )}

      {nextCursor !== null && (
        <Button variant="ghost" disabled={loadingMore} onClick={() => void loadMore()}>
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      )}

      {adding ? (
        <WordForm
          labels={labels}
          initial={emptyDraft}
          submitLabel="Add word"
          busy={addBusy}
          error={addError}
          onSubmit={(draft) => void addWord(draft)}
          onCancel={() => {
            setAdding(false);
            setAddError(null);
          }}
        />
      ) : (
        <Button variant="primary" onClick={() => setAdding(true)}>
          Add a word
        </Button>
      )}
    </section>
  );
}
