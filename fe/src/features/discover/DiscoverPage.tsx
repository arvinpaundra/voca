import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Result } from "effect";
import type { PublicDeck } from "@voca/contract";
import { Button } from "../../components/Button";
import { Container } from "../../components/Container";
import { Wordmark } from "../../components/Wordmark";
import { session } from "../../lib/appSession";
import { communityQuery, mergeTermLangs, type CommunitySort, type DiscoverFilter } from "./discoverModel";
import { forkDeck, forkMessage } from "./fork";
import styles from "./discover.module.css";

const SEARCH_DELAY_MS = 300;

const sortOptions: readonly { value: CommunitySort; label: string }[] = [
  { value: "new", label: "Newest" },
  { value: "forks", label: "Most forked" }
];

const initialFilter: DiscoverFilter = { q: "", termLang: null, sort: "new" };

type Listing = {
  decks: readonly PublicDeck[];
  nextCursor: string | null;
};

export function DiscoverPage() {
  const [searchInput, setSearchInput] = useState("");
  const [filter, setFilter] = useState<DiscoverFilter>(initialFilter);
  const [listing, setListing] = useState<Listing | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [knownLangs, setKnownLangs] = useState<readonly string[]>([]);
  const [forking, setForking] = useState<string | null>(null);
  const [forkError, setForkError] = useState<string | null>(null);

  // Each filter change starts a new generation; a page that arrives from an older one is dropped.
  const generation = useRef(0);

  // The search goes out after a pause, or at once on Enter (see `search`).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilter((previous) => (previous.q === searchInput.trim() ? previous : { ...previous, q: searchInput.trim() }));
    }, SEARCH_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const current = ++generation.current;
    setLoadError(null);
    setListing(null);

    session.call((client) => client.community.list({ query: communityQuery(filter) })).then((result) => {
      if (current !== generation.current) return;

      if (Result.isSuccess(result)) {
        setListing({ decks: result.success.items, nextCursor: result.success.nextCursor });
        setKnownLangs((known) => mergeTermLangs(known, result.success.items));
      } else {
        setLoadError("Could not load community decks.");
      }
    });
  }, [filter]);

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilter((previous) => ({ ...previous, q: searchInput.trim() }));
  };

  const changeLang = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setFilter((previous) => ({ ...previous, termLang: value === "" ? null : value }));
  };

  const changeSort = (event: ChangeEvent<HTMLSelectElement>) => {
    const sort = event.target.value as CommunitySort;
    setFilter((previous) => ({ ...previous, sort }));
  };

  const clearFilters = () => {
    setSearchInput("");
    setFilter(initialFilter);
  };

  const loadMore = async () => {
    if (listing === null || listing.nextCursor === null || loadingMore) return;

    const current = generation.current;
    const cursor = listing.nextCursor;
    setLoadingMore(true);

    const result = await session.call((client) =>
      client.community.list({ query: { ...communityQuery(filter), cursor } })
    );

    setLoadingMore(false);
    if (current !== generation.current) return;

    if (Result.isSuccess(result)) {
      setListing((previous) => ({
        decks: [...(previous?.decks ?? []), ...result.success.items],
        nextCursor: result.success.nextCursor
      }));
      setKnownLangs((known) => mergeTermLangs(known, result.success.items));
    } else {
      setLoadError("Could not load more decks.");
    }
  };

  const fork = async (deck: PublicDeck) => {
    setForking(deck.slug);
    setForkError(null);

    const outcome = await forkDeck(deck.slug);

    if (outcome.kind === "forked") {
      window.location.assign(`/app/decks/${outcome.slug}`);
      return;
    }

    setForking(null);
    setForkError(forkMessage(outcome));
  };

  const decks = listing?.decks ?? [];

  return (
    <div className={styles.page}>
      <Container>
        <div className={styles.inner}>
          <Wordmark />

          <header className={styles.headerText}>
            <h1 className={styles.title}>Discover</h1>
            <p className={styles.note}>Browse and fork community decks.</p>
          </header>

          <div className={styles.toolbar}>
            <form className={styles.searchForm} role="search" onSubmit={search}>
              <input
                className={styles.input}
                type="search"
                dir="auto"
                aria-label="Search community decks"
                placeholder="Search decks"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </form>
            <select
              className={styles.select}
              aria-label="Term language"
              value={filter.termLang ?? ""}
              onChange={changeLang}
            >
              <option value="">All languages</option>
              {knownLangs.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
            <select className={styles.select} aria-label="Sort" value={filter.sort} onChange={changeSort}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {forkError !== null && <p className={styles.error} role="alert">{forkError}</p>}
          {loadError !== null && <p className={styles.error} role="alert">{loadError}</p>}
          {listing === null && loadError === null && <p className={styles.note}>Loading decks…</p>}

          {listing !== null && decks.length === 0 && (
            <div className={styles.empty}>
              <p className={styles.note}>No decks found</p>
              <Button variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          )}

          {decks.length > 0 && (
            <ul className={styles.grid}>
              {decks.map((deck) => (
                <li key={deck.slug}>
                  <article className={styles.card}>
                    <a className={styles.cardTitle} href={`/app/discover/${deck.slug}`} dir="auto">
                      {deck.title}
                    </a>
                    <p className={styles.owner}>
                      {deck.owner.avatarUrl !== null && (
                        <img className={styles.avatar} src={deck.owner.avatarUrl} alt="" />
                      )}
                      <span dir="auto">{deck.owner.name}</span>
                    </p>
                    <p className={styles.note}>
                      {deck.termLang} → {deck.meaningLang}
                    </p>
                    <p className={styles.note}>
                      {deck.wordCount} words · {deck.forkCount} forks
                    </p>
                    <div className={styles.cardActions}>
                      <Button variant="ghost" disabled={forking !== null} onClick={() => void fork(deck)}>
                        {forking === deck.slug ? "Forking…" : "Fork"}
                      </Button>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}

          {listing !== null && listing.nextCursor !== null && (
            <Button variant="ghost" disabled={loadingMore} onClick={() => void loadMore()}>
              {loadingMore ? "Loading…" : "Load more"}
            </Button>
          )}
        </div>
      </Container>
    </div>
  );
}
