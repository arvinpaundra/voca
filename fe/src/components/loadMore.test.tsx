import { afterEach, describe, expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoadMore } from "./LoadMore";
import { fakeObserver, fakeViewport } from "../test/pagedApi";

// The end of a paged list: its button asks for the next page; on a phone, scrolling it into view asks too.

let observer: ReturnType<typeof fakeObserver> | null = null;
let viewport: ReturnType<typeof fakeViewport> | null = null;

afterEach(() => {
  observer?.restore();
  viewport?.restore();
  observer = null;
  viewport = null;
});

describe("LoadMore", () => {
  test("shows nothing once there is no next page", () => {
    observer = fakeObserver();
    const { container } = render(<LoadMore hasNextPage={false} isFetchingNextPage={false} onLoadMore={() => {}} />);

    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(container.textContent).toBe("");
  });

  test("the Load more button asks for the next page", async () => {
    observer = fakeObserver();
    const onLoadMore = mock(() => {});
    const user = userEvent.setup();
    render(<LoadMore hasNextPage isFetchingNextPage={false} onLoadMore={onLoadMore} />);

    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  test("on a phone, scrolling to the end asks for the next page", () => {
    observer = fakeObserver();
    viewport = fakeViewport(true);
    const onLoadMore = mock(() => {});
    render(<LoadMore hasNextPage isFetchingNextPage={false} onLoadMore={onLoadMore} />);

    observer.intersect();

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  test("on a phone, scrolling to the end while a page loads asks for nothing", () => {
    observer = fakeObserver();
    viewport = fakeViewport(true);
    const onLoadMore = mock(() => {});
    render(<LoadMore hasNextPage isFetchingNextPage onLoadMore={onLoadMore} />);

    observer.intersect();

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  test("the button cannot be pressed while a page loads", async () => {
    observer = fakeObserver();
    const onLoadMore = mock(() => {});
    const user = userEvent.setup();
    render(<LoadMore hasNextPage isFetchingNextPage onLoadMore={onLoadMore} />);

    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(onLoadMore).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Load more" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("on a phone, stops watching once it is gone", () => {
    observer = fakeObserver();
    viewport = fakeViewport(true);
    const onLoadMore = mock(() => {});
    const { unmount } = render(<LoadMore hasNextPage isFetchingNextPage={false} onLoadMore={onLoadMore} />);

    unmount();
    observer.intersect();

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  test("wider than a phone, scrolling to the end asks for nothing and the button still does", async () => {
    observer = fakeObserver();
    viewport = fakeViewport(false);
    const onLoadMore = mock(() => {});
    const user = userEvent.setup();
    render(<LoadMore hasNextPage isFetchingNextPage={false} onLoadMore={onLoadMore} />);

    observer.intersect();

    expect(onLoadMore).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Load more" }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
