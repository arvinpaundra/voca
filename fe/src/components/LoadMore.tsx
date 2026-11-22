import { useEffect, useRef, useSyncExternalStore } from "react";
import { Button } from "./Button";

// The phone layout's breakpoint: only there does the list load by itself as it scrolls.
const PHONE = "(max-width: 640px)";

const subscribePhone = (onChange: () => void) => {
  const query = window.matchMedia(PHONE);

  query.addEventListener("change", onChange);

  return () => query.removeEventListener("change", onChange);
};

const isPhone = () => window.matchMedia(PHONE).matches;

/**
 * The end of a paged list. While `hasNextPage`: a "Load more" button that asks for the next page and, on a phone
 * only, an element that asks for it by itself when it scrolls into view (IntersectionObserver, once per page, never
 * while one is loading). Nothing at all once there is no next page.
 */
export function LoadMore({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const phone = useSyncExternalStore(subscribePhone, isPhone);

  // The observer lives across renders, so it reads the latest callback and loading state through this ref.
  const latest = useRef({ isFetchingNextPage, onLoadMore });

  useEffect(() => {
    latest.current = { isFetchingNextPage, onLoadMore };
  });

  // The observer is made again after each page: a sentinel still in view then gets reported again.
  useEffect(() => {
    const element = sentinel.current;

    if (!phone || !hasNextPage || isFetchingNextPage || element === null) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);

        if (!visible || latest.current.isFetchingNextPage) return;

        latest.current.onLoadMore();
      },
      { rootMargin: "200px" },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [phone, hasNextPage, isFetchingNextPage]);

  if (!hasNextPage) return null;

  return (
    <div ref={sentinel} style={{ display: "flex", justifyContent: "center" }}>
      <Button variant="ghost" busy={isFetchingNextPage} onClick={onLoadMore}>
        Load more
      </Button>
    </div>
  );
}
