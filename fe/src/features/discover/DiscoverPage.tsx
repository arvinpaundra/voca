import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Result } from "effect";
import type { PublicDeck } from "@voca/contract";
import { Compass, Search, SearchX } from "lucide-react";
import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { session } from "../../lib/appSession";
import { communityQuery, mergeTermLangs, type CommunitySort, type DiscoverFilter } from "./discoverModel";
import { forkDeck, forkMessage } from "./fork";

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
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime/20">
          <Compass className="size-5 text-stone-900" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-montserrat text-2xl font-semibold text-stone-900">Discover</h1>
          <p className="mt-0.5 text-sm text-stone-500">Browse and fork community decks.</p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3">
        <form role="search" onSubmit={search} className="flex min-w-0 flex-1 items-center gap-2">
          <Search className="size-4 shrink-0 text-stone-400" aria-hidden="true" />
          <input
            type="search"
            dir="auto"
            aria-label="Search community decks"
            placeholder="Search decks or creators…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="w-full min-w-0 bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
          />
        </form>
        <div className="hidden h-4 w-px bg-stone-200 sm:block" aria-hidden="true" />
        <select
          aria-label="Term language"
          value={filter.termLang ?? ""}
          onChange={changeLang}
          className="cursor-pointer bg-transparent text-sm text-stone-600 outline-none"
        >
          <option value="">All languages</option>
          {knownLangs.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort"
          value={filter.sort}
          onChange={changeSort}
          className="cursor-pointer bg-transparent text-sm text-stone-600 outline-none"
        >
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
      {loadError !== null && (
        <p role="alert" className="text-sm text-red-600">
          {loadError}
        </p>
      )}
      {listing === null && loadError === null && <p className="text-sm text-stone-500">Loading decks…</p>}

      {listing !== null && decks.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <SearchX className="size-10 text-stone-300" aria-hidden="true" />
          <p className="text-lg font-semibold text-stone-900">No decks found</p>
          <p className="text-sm text-stone-400">Try a different search or clear your filters.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-stone-900 underline underline-offset-2 hover:opacity-60"
          >
            Clear filters
          </button>
        </div>
      )}

      {decks.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {decks.map((deck) => (
            <li key={deck.slug}>
              <article className="flex h-full flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
                <a
                  href={`/app/discover/${deck.slug}`}
                  dir="auto"
                  className="line-clamp-2 break-words font-semibold text-stone-900 hover:underline"
                >
                  {deck.title}
                </a>
                <div className="flex min-w-0 items-center gap-2 text-sm text-stone-500">
                  <Avatar name={deck.owner.name} src={deck.owner.avatarUrl} size="sm" />
                  <span dir="auto" className="truncate">
                    {deck.owner.name}
                  </span>
                </div>
                <div className="flex flex-col gap-1 text-xs text-stone-500">
                  <span>
                    {deck.termLang} → {deck.meaningLang}
                  </span>
                  <span className="text-stone-400">
                    {deck.wordCount} words · {deck.forkCount} forks
                  </span>
                </div>
                <div className="mt-auto flex justify-end">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={forking !== null}
                    onClick={() => void fork(deck)}
                  >
                    {forking === deck.slug ? "Forking…" : "Fork"}
                  </Button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {listing !== null && listing.nextCursor !== null && (
        <div className="flex justify-center">
          <Button variant="ghost" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
