/** How many items every paged list asks for at a time. */
export const PAGE_SIZE = 15

/**
 * The items of every page loaded so far, in order. An item whose `slug` an earlier page already holds is dropped:
 * a list that changed between two pages must not show a row twice.
 */
export const mergePages = <T extends { readonly slug: string }>(
  _pages: ReadonlyArray<{ readonly items: ReadonlyArray<T> }>
): T[] => {
  throw new Error("not implemented: PF")
}
