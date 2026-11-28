import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Crawlers never run JavaScript, and Cloudflare Pages serves fe/index.html for every path, so the raw file is
// exactly what X, WhatsApp or Facebook read for `/`, `/login` or a deck URL.

const fe = resolve(import.meta.dir, "../..");

const source = readFileSync(`${fe}/index.html`, "utf8");

const metaTags = [...source.matchAll(/<meta\s[^>]*>/g)].map((tag) =>
  Object.fromEntries([...tag[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value])),
);

const meta = (attribute: "property" | "name", key: string) =>
  metaTags.find((tag) => tag[attribute] === key)?.content;

const title = source.match(/<title>([^<]*)<\/title>/)?.[1];

const IMAGE = "https://voca.arvinpaundra.xyz/og.png";

const pngOf = (bytes: Buffer) =>
  bytes.toString("latin1", 1, 4) === "PNG"
    ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
    : { notPng: bytes.toString("utf8", 0, 64) };

describe("the link preview card", () => {
  test("every path is served the same index.html", () => {
    const redirects = readFileSync(`${fe}/public/_redirects`, "utf8");

    expect(redirects).toMatch(/^\/\*\s+\/index\.html\s+200$/m);
  });

  test("the card's title and description are the page's own", () => {
    expect(meta("property", "og:title")).toBe("Voca · Remember every word");
    expect(title).toBe("Voca · Remember every word");

    expect(meta("property", "og:description")).toBe(
      "Voca is a web app for learning vocabulary with spaced repetition, in any language.",
    );
    expect(meta("name", "description")).toBe(meta("property", "og:description"));
  });

  test("the card always points at the landing page, as a website", () => {
    expect(meta("property", "og:url")).toBe("https://voca.arvinpaundra.xyz/");
    expect(meta("property", "og:type")).toBe("website");
  });

  test("the image is an absolute https URL with its size and type", () => {
    expect(meta("property", "og:image")).toBe(IMAGE);
    expect(meta("property", "og:image:width")).toBe("1200");
    expect(meta("property", "og:image:height")).toBe("630");
    expect(meta("property", "og:image:type")).toBe("image/png");
  });

  test("X shows a large image card with the same image", () => {
    expect(meta("name", "twitter:card")).toBe("summary_large_image");
    expect(meta("name", "twitter:image")).toBe(IMAGE);
  });

  test("the image is a 1200×630 PNG under 300 KB, served as a public static file", () => {
    const bytes = readFileSync(`${fe}/public/og.png`);

    expect(pngOf(bytes)).toEqual({ width: 1200, height: 630 });
    expect(bytes.length).toBeLessThan(300 * 1024);
  });
});
