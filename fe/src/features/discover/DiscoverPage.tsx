import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Result } from "effect";
import type { PublicDeck } from "@voca/contract";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { PageHeader } from "../../components/PageHeader";
import { Skeleton } from "../../components/Skeleton";
import { session } from "../../lib/appSession";
import { communityQuery, mergeTermLangs, type CommunitySort, type DiscoverFilter } from "./discoverModel";
import { PublicDeckTable } from "./PublicDeckTable";
import { forkDeck, forkMessage } from "./fork";

const SEARCH_DELAY_MS = 300;

const controlClass =
  "h-8 cursor-pointer rounded-lg border border-stone-300 bg-white px-2.5 text-sm text-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy";

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
    <div className="w-full py-6 sm:py-8">
      <PageHeader title="Discover" description="Browse and fork community decks." />

      <div className="grid gap-8">
        <div className="flex flex-wrap items-center gap-3">
          <form role="search" onSubmit={search} className="min-w-[200px] flex-1">
            <input
              type="search"
              dir="auto"
              aria-label="Search community decks"
              placeholder="Search decks or creators"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-8 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 placeholder:text-stone-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
            />
          </form>

          <select aria-label="Term language" value={filter.termLang ?? ""} onChange={changeLang} className={controlClass}>
            <option value="">All languages</option>
            {knownLangs.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>

          <select aria-label="Sort" value={filter.sort} onChange={changeSort} className={controlClass}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {forkError !== null && (
          <p role="alert" className="text-sm text-red-600">
            {forkError}
          </p>
        )}

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

        {decks.length > 0 && <PublicDeckTable decks={decks} forking={forking} onFork={(deck) => void fork(deck)} />}

        {listing !== null && listing.nextCursor !== null && (
          <div className="flex justify-center">
            <Button variant="secondary" busy={loadingMore} onClick={() => void loadMore()}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
