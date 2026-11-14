export type CommunitySort = "new" | "forks";

export interface DiscoverFilter {
  readonly q: string;
  readonly termLang: string | null;
  readonly sort: CommunitySort;
}

/** The `community.list` query for a filter: empty search and "all languages" are left out. */
export const communityQuery = (
  _filter: DiscoverFilter
): { readonly q?: string; readonly termLang?: string; readonly sort: CommunitySort } => {
  throw new Error("not implemented: CF");
};
