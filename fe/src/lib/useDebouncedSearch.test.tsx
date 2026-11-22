import { describe, expect, test } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { SEARCH_DELAY_MS, useDebouncedSearch } from "./useDebouncedSearch";

// The text a search box shows and the text the list asks the server for are two values: the first follows every
// keystroke, the second follows it SEARCH_DELAY_MS after the last one, or at once when the Learner submits or clears.

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("useDebouncedSearch", () => {
  test("waits 500 ms", () => {
    expect(SEARCH_DELAY_MS).toBe(500);
  });

  test("starts empty", () => {
    const { result } = renderHook(() => useDebouncedSearch());

    expect(result.current.input).toBe("");
    expect(result.current.search).toBe("");
  });

  test("shows each keystroke at once and searches only after 500 ms without one", async () => {
    const { result } = renderHook(() => useDebouncedSearch());

    const typedAt = Date.now();
    act(() => result.current.setInput("spa"));

    expect(result.current.input).toBe("spa");
    expect(result.current.search).toBe("");

    await act(() => wait(300));
    expect(result.current.search).toBe("");

    await waitFor(() => expect(result.current.search).toBe("spa"), { timeout: 1500 });
    expect(Date.now() - typedAt).toBeGreaterThanOrEqual(450);
  });

  test("a change within 500 ms starts the wait again, and only the final text is searched", async () => {
    const { result } = renderHook(() => useDebouncedSearch());
    const seen: string[] = [];

    act(() => result.current.setInput("s"));
    await act(() => wait(300));
    act(() => result.current.setInput("sp"));
    await act(() => wait(300));

    // 600 ms after the first key, but only 300 ms after the last one.
    seen.push(result.current.search);
    act(() => result.current.setInput("spa"));

    await waitFor(() => expect(result.current.search).toBe("spa"), { timeout: 1500 });
    seen.push(result.current.search);

    expect(seen).toEqual(["", "spa"]);
  });

  test("the searched text is trimmed", async () => {
    const { result } = renderHook(() => useDebouncedSearch());

    act(() => result.current.setInput("  spa "));
    act(() => result.current.submit());

    expect(result.current.input).toBe("  spa ");
    expect(result.current.search).toBe("spa");
  });

  test("submitting searches at once", () => {
    const { result } = renderHook(() => useDebouncedSearch());

    act(() => result.current.setInput("spa"));
    act(() => result.current.submit());

    expect(result.current.search).toBe("spa");
  });

  test("emptying the box searches at once", async () => {
    const { result } = renderHook(() => useDebouncedSearch());

    act(() => result.current.setInput("spa"));
    act(() => result.current.submit());
    expect(result.current.search).toBe("spa");

    act(() => result.current.setInput(""));

    await waitFor(() => expect(result.current.search).toBe(""), { timeout: 100 });
  });

  test("clear empties the box and the search at once", () => {
    const { result } = renderHook(() => useDebouncedSearch());

    act(() => result.current.setInput("spa"));
    act(() => result.current.submit());
    act(() => result.current.clear());

    expect(result.current.input).toBe("");
    expect(result.current.search).toBe("");
  });

  test("a pending search is dropped by clear", async () => {
    const { result } = renderHook(() => useDebouncedSearch());

    act(() => result.current.setInput("spa"));
    act(() => result.current.clear());

    await act(() => wait(700));

    expect(result.current.input).toBe("");
    expect(result.current.search).toBe("");
  });
});
