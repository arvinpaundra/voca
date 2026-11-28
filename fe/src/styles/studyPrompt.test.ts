import { describe, test } from "bun:test";

const css = (await Bun.file(new URL("./console.css", import.meta.url)).text()).replace(/\/\*[\s\S]*?\*\//g, "");

const MEDIA = /@media([^{]+)\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g;

const PHONE = /^\(\s*max-width:\s*639px\s*\)$/;

const topLevel = css.replace(MEDIA, "");

const phone = [...css.matchAll(MEDIA)]
  .filter(([, query]) => PHONE.test(query!.trim()))
  .map(([, , body]) => body!)
  .join("\n");

const valuesIn = (sheet: string, selector: string, property: string) =>
  [...sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, list]) => list!.split(",").some((entry) => entry.trim() === selector))
    .flatMap(([, , body]) => body!.split(";"))
    .map((declaration) => declaration.split(":"))
    .filter((parts) => parts.length >= 2 && parts[0]!.trim() === property)
    .map(([, ...value]) => value.join(":").trim());

const need = (ok: boolean, what: string) => {
  if (!ok) throw new Error(`not implemented: SL: ${what}`);
};

const needValue = (sheet: string, where: string, selector: string, property: string, value: string) => {
  const found = valuesIn(sheet, selector, property);

  need(found.includes(value), `${where} \`${selector}\` has ${property}: ${found.join(", ") || "nothing"}, not ${value}`);
};

describe("a study prompt's size follows its length", () => {
  test("1–6 characters keep today's size", () => {
    needValue(topLevel, "everywhere", ".prompt .term", "font", "600 clamp(52px, 8vw, 80px)/1.15 var(--f-term)");
  });

  test("7–14 characters: 48 px, 36 px on a phone", () => {
    needValue(topLevel, "on desktop", '.prompt[data-size="medium"] .term', "font-size", "48px");
    needValue(phone, "on a phone", '.prompt[data-size="medium"] .term', "font-size", "36px");
  });

  test("15 or more: 32 px, 24 px on a phone", () => {
    needValue(topLevel, "on desktop", '.prompt[data-size="long"] .term', "font-size", "32px");
    needValue(phone, "on a phone", '.prompt[data-size="long"] .term', "font-size", "24px");
  });

  test("a prompt wraps instead of being cut off", () => {
    needValue(topLevel, "everywhere", ".prompt .term", "overflow-wrap", "anywhere");
  });
});

describe("on a phone the answered verdict is pinned to the bottom", () => {
  test("the verdict is fixed above the browser's safe area", () => {
    needValue(phone, "on a phone", ".verdict", "position", "fixed");

    const bottom = valuesIn(phone, ".verdict", "bottom");

    need(bottom.some((value) => value.includes("env(safe-area-inset-bottom")), `on a phone \`.verdict\` has bottom: ${bottom.join(", ") || "nothing"}, not above env(safe-area-inset-bottom)`);
  });

  test("the page makes room for it, so it never covers the last option", () => {
    const padding = valuesIn(phone, ".study:has(.verdict)", "padding-bottom");

    need(padding.some((value) => value.includes("env(safe-area-inset-bottom")), `on a phone \`.study:has(.verdict)\` has padding-bottom: ${padding.join(", ") || "nothing"}`);
  });

  test("on wider screens the verdict stays in the flow", () => {
    need(valuesIn(topLevel, ".verdict", "position").every((value) => value !== "fixed"), "`.verdict` is fixed outside the phone layout");
  });
});
