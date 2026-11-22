/** How many items every paged list asks for at a time. */
export const PAGE_SIZE = 15

/**
 * The items of every page loaded so far, in order. An item whose `slug` an earlier page already holds is dropped:
 * a list that changed between two pages must not show a row twice.
 */
export const mergePages = <T extends { readonly slug: string }>(
  pages: ReadonlyArray<{ readonly items: ReadonlyArray<T> }>
): T[] => {
  const seen = new Set<string>()
  const merged: T[] = []

  for (const page of pages) {
    for (const item of page.items) {
      if (seen.has(item.slug)) continue

      seen.add(item.slug)
      merged.push(item)
    }
  }

  return merged
}
