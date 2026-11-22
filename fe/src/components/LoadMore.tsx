/**
 * The end of a paged list. While `hasNextPage`: an element that asks for the next page by itself when it scrolls
 * into view (IntersectionObserver, once per page, never while one is loading), and a "Load more" button that asks
 * for the same page. Nothing at all once there is no next page.
 */
export function LoadMore(_props: {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
}): never {
  throw new Error("not implemented: PF")
}
