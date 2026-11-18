import { useEffect, useRef, useState, type FormEvent } from "react";
import { Result } from "effect";
import type { PublicDeck } from "@voca/contract";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { PageHeader } from "../../components/PageHeader";
import { SearchInput } from "../../components/SearchInput";
import { Select } from "../../components/Select";
import { Skeleton } from "../../components/Skeleton";
import { session } from "../../lib/appSession";
import { communityQuery, mergeTermLangs, type CommunitySort, type DiscoverFilter } from "./discoverModel";
import { PublicDeckRows } from "./PublicDeckRows";
import { forkDeck, forkMessage } from "./fork";

const SEARCH_DELAY_MS = 300;

const sortOptions: readonly { value: CommunitySort; label: string }[] = [
  { value: "new", label: "Newest" },
  { value: "forks", label: "Most forked" },
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

  const changeLang = (value: string) => {
    setFilter((previous) => ({ ...previous, termLang: value === "" ? null : value }));
  };

  const changeSort = (value: string) => {
    setFilter((previous) => ({ ...previous, sort: value as CommunitySort }));
  };

  const clearFilters = () => {
    setSearchInput("");
    setFilter(initialFilter);
  };

  // A new filter object restarts the load with the same query.
  const retry = () => {
    setFilter((previous) => ({ ...previous }));
  };

  const loadMore = async () => {
    if (listing === null || listing.nextCursor === null || loadingMore) return;

    const current = generation.current;
    const cursor = listing.nextCursor;
    setLoadingMore(true);

    const result = await session.call((client) =>
      client.community.list({ query: { ...communityQuery(filter), cursor } }),
    );

    setLoadingMore(false);
    if (current !== generation.current) return;

    if (Result.isSuccess(result)) {
      setListing((previous) => ({
        decks: [...(previous?.decks ?? []), ...result.success.items],
        nextCursor: result.success.nextCursor,
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
    <>
      <PageHeader
        title="Discover"
        description="Public decks from other learners. Fork one to study it as your own."
      />

      <form role="search" onSubmit={search} className="toolbar">
        <SearchInput
          label="Search public decks"
          placeholder="Search public decks"
          value={searchInput}
          onChange={setSearchInput}
        />

        <Select
          label="Term language"
          value={filter.termLang ?? ""}
          options={[{ value: "", label: "All languages" }, ...knownLangs.map((lang) => ({ value: lang, label: lang }))]}
          onChange={changeLang}
        />

        <Select label="Sort" value={filter.sort} options={sortOptions} onChange={changeSort} />
      </form>

      {forkError !== null && <ErrorState message={forkError} />}

      {listing === null && loadError === null && <Skeleton label="Loading community decks" rows={4} />}

      {loadError !== null && <ErrorState message={loadError} onRetry={retry} />}

      {listing !== null && decks.length === 0 && (
        <EmptyState
          title="No decks found"
          body="Try a different search or clear your filters."
          action={
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      )}

      {decks.length > 0 && <PublicDeckRows decks={decks} forking={forking} onFork={(deck) => void fork(deck)} />}

      {listing !== null && listing.nextCursor !== null && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Button variant="ghost" busy={loadingMore} onClick={() => void loadMore()}>
            Load more
          </Button>
        </div>
      )}
    </>
  );
}
