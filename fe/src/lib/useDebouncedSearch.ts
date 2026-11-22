import { useCallback, useEffect, useRef, useState } from "react";

/** How long a search box waits after the last key before the list asks the server. */
export const SEARCH_DELAY_MS = 500;

export type DebouncedSearch = {
  /** What the box shows: every keystroke, at once. */
  readonly input: string;
  readonly setInput: (value: string) => void;
  /** What the list asks the server for: the trimmed input, once the Learner stopped typing. */
  readonly search: string;
  /** Searches the current input without waiting (Enter). */
  readonly submit: () => void;
  /** Empties the box and the search without waiting ("Clear search"). */
  readonly clear: () => void;
};

export function useDebouncedSearch(): DebouncedSearch {
  const [input, setInputState] = useState("");
  const [search, setSearch] = useState("");

  // The timer lives in a ref so `submit` and `clear` can drop a pending search. The latest text lives in a ref too:
  // `submit` must read the text typed a moment ago, not the one the render it was created in had.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef("");

  const cancelPending = useCallback(() => {
    if (timer.current === null) return;

    clearTimeout(timer.current);
    timer.current = null;
  }, []);

  // The timer starts once the box has rendered the keystroke, so the delay counts from what the Learner sees. Every
  // keystroke replaces the pending search, and an emptied box shows the whole list at once.
  useEffect(() => {
    cancelPending();

    const trimmed = input.trim();

    if (trimmed === "") {
      setSearch("");
      return;
    }

    timer.current = setTimeout(() => {
      timer.current = null;
      setSearch(trimmed);
    }, SEARCH_DELAY_MS);
  }, [input, cancelPending]);

  // A pending search must not fire after the page that owns the box has gone.
  useEffect(() => {
    return () => cancelPending();
  }, [cancelPending]);

  const setInput = useCallback((value: string) => {
    latest.current = value;
    setInputState(value);
  }, []);

  const submit = useCallback(() => {
    cancelPending();
    setSearch(latest.current.trim());
  }, [cancelPending]);

  const clear = useCallback(() => {
    cancelPending();
    latest.current = "";
    setInputState("");
    setSearch("");
  }, [cancelPending]);

  return { input, setInput, search, submit, clear };
}
