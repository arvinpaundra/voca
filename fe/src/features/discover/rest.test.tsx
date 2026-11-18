import { describe, expect, mock, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PublicDeck } from "@voca/contract";
import { SignInPage } from "../auth/SignInPage";
import { LandingPage } from "../landing/LandingPage";
import { SettingsSection } from "../settings/SettingsSection";
import { PublicDeckTable } from "./PublicDeckTable";

const publicDeck = (slug: string, title: string, wordCount: number, forkCount: number) =>
  ({
    slug,
    title,
    description: "",
    termLang: "ja",
    meaningLang: "en",
    publishedAt: "2026-01-01T00:00:00.000Z",
    forkCount,
    wordCount,
    owner: { name: "Aiko Tanaka", avatarUrl: null },
  }) as unknown as PublicDeck;

describe("PublicDeckTable", () => {
  const decks = [publicDeck("DECK000001", "JLPT N5", 640, 31), publicDeck("DECK000002", "Kitchen", 52, 4)];

  test("community decks are rows under column headers", () => {
    render(<PublicDeckTable decks={decks} forking={null} onFork={() => {}} />);

    const table = screen.getByRole("table", { name: "Community decks" });
    const headers = within(table).getAllByRole("columnheader").map((header) => header.textContent);
    expect(headers).toEqual(["Deck", "Owner", "Language", "Words", "Forks", "Actions"]);

    const [first] = within(table).getAllByRole("row").slice(1);
    const row = within(first!);
    expect(row.getByRole("link", { name: "JLPT N5" }).getAttribute("href")).toBe("/app/discover/DECK000001");
    expect(row.getByText("Aiko Tanaka")).toBeDefined();
    expect(row.getByText("ja → en")).toBeDefined();
    expect(row.getByRole("cell", { name: "640" })).toBeDefined();
    expect(row.getByRole("cell", { name: "31" })).toBeDefined();
  });

  test("fork is one button per row, and all wait while one fork runs", async () => {
    const user = userEvent.setup();
    const onFork = mock((_deck: PublicDeck) => {});
    const { rerender } = render(<PublicDeckTable decks={decks} forking={null} onFork={onFork} />);

    await user.click(screen.getByRole("button", { name: "Fork Kitchen" }));
    expect(onFork).toHaveBeenCalledWith(decks[1]!);

    rerender(<PublicDeckTable decks={decks} forking="DECK000002" onFork={onFork} />);

    expect((screen.getByRole("button", { name: "Fork JLPT N5" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Fork Kitchen", busy: true })).toBeDefined();
  });
});

describe("SettingsSection", () => {
  test("a titled region with its help line", () => {
    render(
      <SettingsSection title="Study" description="How sessions start.">
        <p>fields</p>
      </SettingsSection>,
    );

    const section = screen.getByRole("region", { name: "Study" });

    expect(within(section).getByRole("heading", { level: 2, name: "Study" })).toBeDefined();
    expect(within(section).getByText("How sessions start.")).toBeDefined();
    expect(within(section).getByText("fields")).toBeDefined();
  });
});

describe("brand", () => {
  test("sign-in shows the Voca logo and one page heading", () => {
    render(<SignInPage />);

    expect(screen.getAllByRole("img", { name: "Voca" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  test("the landing page shows the Voca logo", () => {
    render(<LandingPage />);

    expect(screen.getAllByRole("img", { name: "Voca" }).length).toBeGreaterThan(0);
  });
});
