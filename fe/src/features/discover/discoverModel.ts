export type CommunitySort = "new" | "forks";

export interface DiscoverFilter {
  readonly q: string;
  readonly termLang: string | null;
  readonly sort: CommunitySort;
}

/** The `community.list` query for a filter: empty search and "all languages" are left out. */
export const communityQuery = (
  filter: DiscoverFilter
): { readonly q?: string; readonly termLang?: string; readonly sort: CommunitySort } => {
  const q = filter.q.trim();

  return {
    ...(q === "" ? {} : { q }),
    ...(filter.termLang === null ? {} : { termLang: filter.termLang }),
    sort: filter.sort
  };
};

/** Every term language seen so far, kept across pages so the language list does not shrink when a filter narrows. */
export const mergeTermLangs = (
  known: readonly string[],
  decks: readonly { readonly termLang: string }[]
): readonly string[] => {
  const merged = new Set(known);

  for (const deck of decks) {
    merged.add(deck.termLang);
  }

  return [...merged].sort();
};
