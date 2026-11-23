import { useCallback, useEffect, useRef, useState } from "react";

export const SEARCH_DELAY_MS = 500;

export type DebouncedSearch = {
  readonly input: string;
  readonly setInput: (value: string) => void;
  readonly search: string;
  readonly submit: () => void;
  readonly clear: () => void;
};

export function useDebouncedSearch(): DebouncedSearch {
  const [input, setInputState] = useState("");
  const [search, setSearch] = useState("");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef("");

  const cancelPending = useCallback(() => {
    if (timer.current === null) return;

    clearTimeout(timer.current);
    timer.current = null;
  }, []);

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
