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
  throw new Error("not implemented: HF");
}
