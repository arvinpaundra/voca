import { expect, test } from "bun:test";
import { generateCodeChallenge, generateCodeVerifier } from "./auth.ts";

test("code verifier matches RFC 7636 charset and length", () => {
  expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/);
});

test("code challenge is a 43-char base64url SHA-256", async () => {
  expect(await generateCodeChallenge("test-verifier")).toMatch(/^[A-Za-z0-9_-]{43}$/);
});
