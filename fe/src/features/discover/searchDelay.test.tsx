import { afterEach, describe, expect, test } from "bun:test";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cacheSession } from "../../test/cacheSession";
import { pageOf, publicDeck } from "../../test/pagedApi";
import { DiscoverPage } from "./DiscoverPage";

// The Discover title search shows each keystroke at once and asks the server 500 ms after the last one; Enter and an
// emptied box ask at once. The list on screen stays as it is until the search is sent.

type Query = { q?: string; termLang?: string; sort?: string; cursor?: string; limit?: number };

const ALL = Array.from({ length: 40 }, (_, i) => publicDeck(i));

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
});

const serve = () => {
  const requests: Query[] = [];

  const api = cacheSession("HF", {
    "community.list": (request: { query: Query }) => {
      requests.push(request.query);

      const q = request.query.q?.toLowerCase();

      return pageOf(
        ALL.filter((deck) => q === undefined || deck.title.toLowerCase().includes(q)),
        request.query,
      );
    },
  });
  restore = api.restore;

  return requests;
};

const searches = (requests: Query[]) => requests.filter((request) => request.q !== undefined).map((request) => request.q);

const rows = () => within(screen.getByRole("list", { name: "Community decks" })).getAllByRole("listitem");

const open = async () => {
  render(<DiscoverPage />);
  await screen.findByText("Public 00");

  return screen.getByRole("searchbox", { name: "Search public decks" }) as HTMLInputElement;
};

describe("the Discover search", () => {
  test("typing 'Public 1' with 100 ms between keys sends one search, 500 ms after the last key", async () => {
    const requests = serve();
    const user = userEvent.setup({ delay: 100 });
    const box = await open();

    await user.type(box, "Public 1");
    const typedAt = Date.now();

    await act(() => wait(300));

    expect(box.value).toBe("Public 1");
    expect(searches(requests)).toEqual([]);
    expect(rows()).toHaveLength(15);

    await waitFor(() => expect(rows()).toHaveLength(10), { timeout: 1500 });

    expect(searches(requests)).toEqual(["Public 1"]);
    expect(Date.now() - typedAt).toBeGreaterThanOrEqual(380);
    expect(screen.getByRole("searchbox", { name: "Search public decks" })).toBe(box);
  });

  test("Enter sends the search without waiting", async () => {
    const requests = serve();
    const user = userEvent.setup();
    const box = await open();

    await user.type(box, "Public 1{Enter}");

    await waitFor(() => expect(rows()).toHaveLength(10), { timeout: 300 });
    expect(searches(requests)).toEqual(["Public 1"]);
  });

  test("emptying the box brings the whole list back without waiting", async () => {
    serve();
    const user = userEvent.setup();
    const box = await open();

    await user.type(box, "Public 1{Enter}");
    await waitFor(() => expect(rows()).toHaveLength(10), { timeout: 300 });

    await user.clear(box);

    await waitFor(() => expect(rows()).toHaveLength(15), { timeout: 300 });
  });

  test("a search starts again from the first page", async () => {
    const requests = serve();
    const user = userEvent.setup();
    const box = await open();

    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(rows()).toHaveLength(30));

    await user.type(box, "Public 1{Enter}");

    await waitFor(() => expect(searches(requests)).toEqual(["Public 1"]));
    expect(requests.find((request) => request.q !== undefined)?.cursor).toBeUndefined();
  });
});
