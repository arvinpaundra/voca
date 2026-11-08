// Google OAuth 2.0 authorization code flow with PKCE.
// Client-side only: starts the redirect to Google and holds the PKCE params in sessionStorage.

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPE = "openid email profile";
const VERIFIER_KEY = "voca.pkce.verifier";
const STATE_KEY = "voca.pkce.state";

// Access token lives in memory only; refresh token in localStorage.
let accessToken: string | null = null;
export const REFRESH_TOKEN_KEY = "voca.refreshToken";

function base64Url(bytes: Uint8Array): string {
  let s = "";
  for (const byte of bytes) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** RFC 7636: 43–128 chars of `[A-Za-z0-9\-._~]`. 32 bytes → 43 base64url chars. */
export function generateCodeVerifier(): string {
  return base64Url(randomBytes(32));
}

export function generateState(): string {
  return base64Url(randomBytes(32));
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export function redirectUri(): string {
  return `${window.location.origin}/auth/callback`;
}

/** Stores the PKCE params and sends the browser to Google. */
export async function beginSignIn(clientId: string): Promise<void> {
  const verifier = generateCodeVerifier();
  const state = generateState();
  const challenge = await generateCodeChallenge(verifier);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });
  window.location.assign(`${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`);
}

/** Consumes the stored PKCE params after the redirect back. */
export function consumePkce(): { verifier: string; state: string } | null {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const state = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  return verifier && state ? { verifier, state } : null;
}

export function setAccessToken(token: string): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}
