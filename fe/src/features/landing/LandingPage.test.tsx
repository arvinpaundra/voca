import { describe, expect, test } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import { authRedirect } from "../../lib/authRedirect";
import { LandingPage } from "./LandingPage";

const navLinks = (container: HTMLElement) => {
  const nav = container.querySelector(".l-nav") as HTMLElement;

  return within(nav)
    .getAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")]);
};

const startLearningTargets = () => {
  return screen
    .getAllByRole("link", { name: "Start learning" })
    .map((link) => link.getAttribute("href"));
};

describe("LandingPage", () => {
  test("visitor: Sign in and Start learning go to /login", () => {
    const { container } = render(<LandingPage signedIn={false} />);

    expect(navLinks(container)).toEqual([
      ["How it works", "#how-it-works"],
      ["Scripts", "#scripts"],
      ["Discover", "/app/discover"],
      ["Sign in", "/login"],
    ]);

    expect(screen.queryByRole("link", { name: "Open app" })).toBeNull();
    expect(startLearningTargets()).toEqual(["/login", "/login"]);
  });

  test("signed in: Open app instead of Sign in, and Start learning opens the Dashboard", () => {
    const { container } = render(<LandingPage signedIn />);

    expect(navLinks(container)).toEqual([
      ["How it works", "#how-it-works"],
      ["Scripts", "#scripts"],
      ["Discover", "/app/discover"],
      ["Open app", "/app"],
    ]);

    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(startLearningTargets()).toEqual(["/app", "/app"]);

    // The landing stays reachable: a signed-in Learner is not sent away from it.
    expect(authRedirect("/", true)).toBeNull();
  });

  test("the hero shares the sections' max width and centring", () => {
    const { container } = render(<LandingPage signedIn />);

    const hero = container.querySelector(".l-hero") as HTMLElement;
    const section = container.querySelector("#how-it-works") as HTMLElement;

    expect(section.style.maxWidth).toBe("1120px");

    expect({
      maxWidth: hero.style.maxWidth,
      marginLeft: hero.style.marginLeft,
      marginRight: hero.style.marginRight,
    }).toEqual({
      maxWidth: section.style.maxWidth,
      marginLeft: section.style.marginLeft,
      marginRight: section.style.marginRight,
    });
  });
});
