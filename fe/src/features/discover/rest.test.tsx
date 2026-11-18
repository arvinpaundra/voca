import { describe, expect, mock, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PublicDeck, Word } from "@voca/contract";
import { SignInPage } from "../auth/SignInPage";
import { LandingPage } from "../landing/LandingPage";
import { SettingsRow } from "../settings/SettingsRow";
import { SettingsSection } from "../settings/SettingsSection";
import { PreviewList } from "./PreviewList";
import { PublicDeckRows } from "./PublicDeckRows";

// Markup and class names follow the Discover, Settings, Sign in and Landing screens of
// docs/design/ui-refinement.html (Console).

const publicDeck = (slug: string, title: string, wordCount: number, forkCount: number, name: string) =>
  ({
    slug,
    title,
    description: "",
    termLang: "ja",
    meaningLang: "en",
    publishedAt: "2026-01-01T00:00:00.000Z",
    forkCount,
    wordCount,
    owner: { name, avatarUrl: null },
  }) as unknown as PublicDeck;

const word = (slug: string, term: string, meaning: string) =>
  ({ slug, term, reading: null, meaning, example: null, notes: null, createdAt: "2026-01-01T00:00:00.000Z" }) as unknown as Word;

const sorted = (element: Element | null | undefined) => [...(element?.classList ?? [])].sort();

describe("PublicDeckRows", () => {
  const decks = [publicDeck("DECK000007", "JLPT Core 800", 800, 1200, "Mika T."), publicDeck("DECK000008", "HSK 2 complete", 300, 640, "Wei L.")];

  test("a .pub-head over .deck.pub rows: title, author, language, forks", () => {
    const { container } = render(<PublicDeckRows decks={decks} forking={null} onFork={() => {}} />);

    const list = screen.getByRole("list", { name: "Community decks" });
    expect(sorted(list)).toEqual(["deck-grid", "pub-grid"]);
    expect([...container.querySelectorAll(".list-head.pub-head span")].map((span) => span.textContent)).toEqual([
      "Deck",
      "Author",
      "Languages",
      "Forks",
      "",
    ]);

    const row = list.querySelector("li > article.deck.pub") as HTMLElement;
    const title = within(row).getByRole("link", { name: "JLPT Core 800" });
    expect(title.getAttribute("href")).toBe("/app/discover/DECK000007");
    expect(title.classList.contains("deck-title")).toBe(true);

    expect(row.querySelector(".author .avatar")?.textContent).toBe("M");
    expect(row.querySelector(".author")?.textContent).toBe("MMika T.");
    expect(sorted(within(row).getByText("ja → en"))).toEqual(["badge", "badge-outline", "lang"]);
    expect(within(row).getByText("800 words").classList.contains("badge")).toBe(true);
    expect(row.querySelector(".deck-foot > span")?.textContent).toBe("1.2k forks");
    expect(list.querySelectorAll("article.deck.pub")[1]?.querySelector(".deck-foot > span")?.textContent).toBe("640 forks");
  });

  test("Fork is a small secondary button per row, and all wait while one fork runs", async () => {
    const user = userEvent.setup();
    const onFork = mock((_deck: PublicDeck) => {});
    const { rerender } = render(<PublicDeckRows decks={decks} forking={null} onFork={onFork} />);

    const fork = screen.getByRole("button", { name: "Fork HSK 2 complete" });
    expect(sorted(fork)).toEqual(["btn", "btn-secondary", "btn-sm"]);
    await user.click(fork);
    expect(onFork).toHaveBeenCalledWith(decks[1]!);

    rerender(<PublicDeckRows decks={decks} forking="DECK000008" onFork={onFork} />);

    expect((screen.getByRole("button", { name: "Fork JLPT Core 800" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Fork HSK 2 complete", busy: true })).toBeDefined();
  });
});

describe("PreviewList", () => {
  test("a .preview-list of term and meaning, with how many of the deck it shows", () => {
    render(<PreviewList words={[word("WRD000000005", "水", "water"), word("WRD000000006", "学校", "school")]} total={800} termLang="ja" meaningLang="en" />);

    const list = screen.getByRole("list", { name: "Preview" });
    expect(list.classList.contains("preview-list")).toBe(true);

    const items = list.querySelectorAll("li");
    expect(items).toHaveLength(3);
    expect(items[0]?.querySelector(".t")?.textContent).toBe("水");
    expect(items[0]?.querySelector(".t")?.getAttribute("lang")).toBe("ja");
    expect(items[0]?.textContent).toBe("水water");
    expect(sorted(items[2])).toEqual(["more"]);
    expect(items[2]?.textContent).toBe("Showing 2 of 800 words");
  });
});

describe("settings", () => {
  test("SettingsSection is a .card region titled by its .h2", () => {
    render(
      <SettingsSection title="Study preferences">
        <p>rows</p>
      </SettingsSection>,
    );

    const section = screen.getByRole("region", { name: "Study preferences" });

    expect(section.classList.contains("card")).toBe(true);
    expect(within(section).getByRole("heading", { level: 2, name: "Study preferences" }).classList.contains("h2")).toBe(true);
    expect(within(section).getByText("rows")).toBeDefined();
  });

  test("SettingsRow puts the label and its help left of the control", () => {
    render(
      <SettingsRow label="Day starts at" help="Reviews after this hour count for the new day">
        <button type="button">04:00</button>
      </SettingsRow>,
    );

    const control = screen.getByRole("button", { name: "04:00" });
    const row = control.closest(".set-row");

    expect(row).not.toBeNull();
    expect(row?.querySelector(".lbl b")?.textContent).toBe("Day starts at");
    expect(row?.querySelector(".lbl span")?.textContent).toBe("Reviews after this hour count for the new day");
  });
});

describe("public pages", () => {
  test("sign-in is the .auth split: art with the logo, and the form with one h1 and the Google button", () => {
    const { container } = render(<SignInPage />);

    expect(screen.getAllByRole("img", { name: "Voca" })).toHaveLength(1);

    const art = container.querySelector(".auth > .auth-art") as HTMLElement;
    expect(within(art).getByRole("img", { name: "Voca" })).toBeDefined();
    expect(within(art).getByText("Spaced repetition · any language").classList.contains("eyebrow")).toBe(true);
    expect(within(art).getByRole("heading", { level: 2 }).textContent).toBe("Build the habit. Remember for life.");

    const card = container.querySelector(".auth > .auth-form .auth-card") as HTMLElement;
    const title = within(card).getByRole("heading", { level: 1, name: "Welcome back" });
    expect(title.classList.contains("h1")).toBe(true);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(within(card).getByRole("button", { name: "Continue with Google" }).classList.contains("gbtn")).toBe(true);

    const back = within(card).getByRole("link", { name: "Back to home" });
    expect(back.getAttribute("href")).toBe("/");
    expect(back.classList.contains("back")).toBe(true);
  });

  test("the landing page: .l-nav with the logo and Sign in, and the .l-hero", () => {
    const { container } = render(<LandingPage />);

    screen.getAllByRole("img", { name: "Voca" });

    const nav = container.querySelector(".l-nav") as HTMLElement;
    expect(within(nav).getByRole("img", { name: "Voca" })).toBeDefined();
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual(["How it works", "Scripts", "Discover", "Sign in"]);

    const signIn = within(nav).getByRole("link", { name: "Sign in" });
    expect(signIn.getAttribute("href")).toBe("/login");
    expect(sorted(signIn)).toEqual(["btn", "btn-secondary", "btn-sm"]);

    const hero = container.querySelector(".l-hero") as HTMLElement;
    expect(within(hero).getByRole("heading", { level: 1 }).textContent).toBe("Remember every word.");
    expect(hero.querySelector(".pill")?.textContent).toBe("Spaced repetition · any language");

    const start = within(hero).getByRole("link", { name: "Start learning" });
    expect(start.getAttribute("href")).toBe("/login");
    expect(sorted(start)).toEqual(["btn", "btn-primary"]);
    expect(hero.querySelector(".prompt .term")?.getAttribute("lang")).toBe("ja");
  });
});
