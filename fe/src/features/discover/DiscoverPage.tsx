import { useEffect, useState, type FormEvent } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { PublicDeck } from "@voca/contract";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { PageHeader } from "../../components/PageHeader";
import { SearchInput } from "../../components/SearchInput";
import { Select } from "../../components/Select";
import { Skeleton } from "../../components/Skeleton";
import { LoadMore } from "../../components/LoadMore";
import { mergePages } from "../../lib/paging";
import { communityQuery } from "../../lib/queries";
import { queryClient } from "../../lib/queryClient";
import {
  communityQuery as communityParams,
  mergeTermLangs,
  type CommunitySort,
  type DiscoverFilter,
} from "./discoverModel";
import { PublicDeckRows } from "./PublicDeckRows";
import { forkDeck, forkMessage } from "./fork";
import { useDebouncedSearch } from "../../lib/useDebouncedSearch";

const SEARCH_DELAY_MS = 300;

const sortOptions: readonly { value: CommunitySort; label: string }[] = [
  { value: "new", label: "Newest" },
  { value: "forks", label: "Most forked" },
];

const initialFilter: DiscoverFilter = { q: "", termLang: null, sort: "new" };

export function DiscoverPage() {
  useDebouncedSearch();
  const [searchInput, setSearchInput] = useState("");
  const [filter, setFilter] = useState<DiscoverFilter>(initialFilter);
  const [knownLangs, setKnownLangs] = useState<readonly string[]>([]);
  const [forking, setForking] = useState<string | null>(null);
  const [forkError, setForkError] = useState<string | null>(null);

  // Each filter has its own cached pages; the first page of the default filter is usually already there.
  const community = useInfiniteQuery(communityQuery(communityParams(filter)), queryClient);
  const decks: readonly PublicDeck[] = mergePages(community.data?.pages ?? []);
  const hasPages = community.data !== undefined;

  // The search goes out after a pause, or at once on Enter (see `search`).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilter((previous) => (previous.q === searchInput.trim() ? previous : { ...previous, q: searchInput.trim() }));
    }, SEARCH_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // The language list keeps every language seen on any page, so it does not shrink when a filter narrows.
  useEffect(() => {
    if (community.data === undefined) return;

    setKnownLangs((known) => mergeTermLangs(known, mergePages(community.data.pages)));
  }, [community.data]);

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

  const retry = () => {
    void community.refetch();
  };

  const loadMore = () => {
    if (!community.hasNextPage || community.isFetchingNextPage) return;

    void community.fetchNextPage();
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

  // A failed first page leaves no data; a failed later page keeps the pages already shown.
  const loadError = community.isError
    ? hasPages
      ? "Could not load more decks."
      : "Could not load community decks."
    : null;

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

      {community.isPending && <Skeleton label="Loading community decks" rows={4} />}

      {loadError !== null && <ErrorState message={loadError} onRetry={retry} />}

      {hasPages && decks.length === 0 && (
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

      <LoadMore
        hasNextPage={community.hasNextPage}
        isFetchingNextPage={community.isFetchingNextPage}
        onLoadMore={loadMore}
      />
    </>
  );
}
