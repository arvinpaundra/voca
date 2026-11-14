import { expect, test } from "bun:test";
import { communityQuery } from "./discoverModel";

// The server rejects an empty search, so the page sends `q` only when it has text.

test("only the sort when nothing is filtered", () => {
  expect(communityQuery({ q: "", termLang: null, sort: "new" })).toEqual({ sort: "new" });
  expect(communityQuery({ q: "   ", termLang: null, sort: "forks" })).toEqual({ sort: "forks" });
});

test("a trimmed search and a language", () => {
  expect(communityQuery({ q: "  jlpt ", termLang: "ja", sort: "forks" })).toEqual({
    q: "jlpt",
    termLang: "ja",
    sort: "forks"
  });
});
