export const PAGE_SIZE = 15

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
