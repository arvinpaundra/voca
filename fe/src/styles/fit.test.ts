import { describe, test } from "bun:test";

// Every screen fits the phone's width: text wraps instead of being cut off with "…", hidden or scrolled sideways.
// happy-dom lays nothing out, so the stylesheet is read as text. A grid track sized `1fr` or left implicit grows
// to its widest child, so each column that holds long text has to be allowed to shrink with `minmax(0, 1fr)`.

const css = (await Bun.file(new URL("./console.css", import.meta.url)).text()).replace(/\/\*[\s\S]*?\*\//g, "");

// The declarations of every rule that lists `selector`, inside a media query or not.
const declarationsOf = (selector: string): ReadonlyArray<readonly [string, string]> =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, list]) => list!.split(",").some((entry) => entry.trim() === selector))
    .flatMap(([, , body]) => body!.split(";"))
    .map((declaration) => declaration.split(":"))
    .filter((parts) => parts.length >= 2)
    .map(([name, ...value]) => [name!.trim(), value.join(":").trim()] as const);

const valuesOf = (selector: string, property: string) =>
  declarationsOf(selector)
    .filter(([name]) => name === property)
    .map(([, value]) => value);

const declares = (selector: string, property: string, values: readonly string[]) =>
  valuesOf(selector, property).some((value) => values.includes(value));

const breaksAnywhere = (selector: string) =>
  declares(selector, "overflow-wrap", ["anywhere", "break-word"]) || declares(selector, "word-break", ["break-word", "break-all"]);

const shrinks = (selector: string) => declares(selector, "grid-template-columns", ["minmax(0, 1fr)"]);

// What the FR rules out: "…", hidden text, a line that can't wrap, and a box that scrolls sideways.
const cutsOff = (selector: string): string | null => {
  if (declares(selector, "text-overflow", ["ellipsis"])) return "text-overflow: ellipsis";
  if (declares(selector, "white-space", ["nowrap", "pre"])) return "white-space: nowrap";

  for (const property of ["overflow", "overflow-x"]) {
    const hiding = valuesOf(selector, property).find((value) => ["hidden", "clip", "auto", "scroll"].includes(value));

    if (hiding !== undefined) return `${property}: ${hiding}`;
  }

  return null;
};

const need = (ok: boolean, what: string) => {
  if (!ok) throw new Error(`not implemented: FIT: ${what}`);
};

const needNoCutOff = (selectors: readonly string[]) => {
  for (const selector of selectors) {
    const found = cutsOff(selector);

    need(found === null, `\`${selector}\` has ${found}`);
  }
};

describe("the word page", () => {
  test("the page column shrinks to the screen instead of growing to its widest child", () => {
    need(shrinks(".content"), "`.content` has no grid-template-columns: minmax(0, 1fr)");
    need(shrinks(".dash-main"), "`.dash-main` has no grid-template-columns: minmax(0, 1fr)");

    for (const value of valuesOf(".dash", "grid-template-columns")) {
      need(value.startsWith("minmax(0, 1fr)"), `\`.dash\` has grid-template-columns: ${value} (its first track must be minmax(0, 1fr))`);
    }
  });

  test("the reading above the term is a line of its own that wraps", () => {
    need(
      declares(".word-hero .t ruby", "display", ["inline-flex", "flex", "inline-grid", "grid", "block", "inline-block"]),
      "`.word-hero .t ruby` keeps the ruby layout, which never wraps a long reading",
    );
    need(declares(".word-hero .t rt", "display", ["block"]), "`.word-hero .t rt` has no display: block");
    need(breaksAnywhere(".word-hero .t rt"), "`.word-hero .t rt` has no overflow-wrap: anywhere");
  });

  test("the drill tabs and the drill's header wrap onto a new line", () => {
    need(declares(".tabs", "flex-wrap", ["wrap"]), "`.tabs` has no flex-wrap: wrap");
    need(declares(".drill-head", "flex-wrap", ["wrap"]), "`.drill-head` has no flex-wrap: wrap");
  });

  test("the history rows wrap inside the card", () => {
    for (const value of valuesOf(".hist", "min-width")) {
      need(value === "0", `\`.hist\` has min-width: ${value}`);
    }

    for (const value of valuesOf(".hist li", "grid-template-columns")) {
      need(!value.includes("px"), `\`.hist li\` has fixed-width columns (${value})`);
    }

    need(breaksAnywhere(".hist li"), "`.hist li` has no overflow-wrap: anywhere");
  });

  test("the history's column headers break between words, never inside one", () => {
    need(declares(".hist .head", "overflow-wrap", ["normal"]), "`.hist .head` has no overflow-wrap: normal");
    need(!declares(".hist .head", "word-break", ["break-all", "break-word"]), "`.hist .head` breaks inside words");
  });

  test("nothing on the page is cut off or scrolls sideways", () => {
    needNoCutOff([
      ".content",
      ".dash",
      ".dash-main",
      ".word-hero .t ruby",
      ".word-hero .t rt",
      ".tabs",
      ".drill-head",
      ".hist-scroll",
      ".hist",
      ".hist li",
      ".hist .head",
      ".empty",
      ".empty p",
    ]);
  });
});

describe("the dashboard", () => {
  test("the Today panel shrinks to the screen and hides nothing", () => {
    need(shrinks(".today"), "`.today` has no grid-template-columns: minmax(0, 1fr)");
    needNoCutOff([".today", ".today .kpis", ".today .kpi"]);
  });

  test("a Today row wraps: the deck title and its drill label are shown whole", () => {
    need(
      declares(".queue li a", "flex-wrap", ["wrap"]) || declares(".queue li a", "display", ["grid"]),
      "`.queue li a` can't wrap (no flex-wrap: wrap, and not a grid)",
    );
    need(breaksAnywhere(".queue .qt"), "`.queue .qt` has no overflow-wrap: anywhere");
    needNoCutOff([".queue li a", ".queue .qt", ".queue .qm"]);
  });
});
