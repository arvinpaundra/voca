# 08 — Authentication

## Flow: Google OAuth 2.0, Authorization Code + PKCE, no cookies

```
Browser (fe)                          API (be)                         Google
  │ 1. generate code_verifier, state (sessionStorage)
  │ 2. redirect ─────────────────────────────────────────────────────▶ /o/oauth2/v2/auth
  │      ?client_id&redirect_uri=<fe>/auth/callback&response_type=code
  │      &scope=openid email profile&code_challenge(S256)&state
  │ 3. ◀──────────────────────── redirect /auth/callback?code&state ──
  │    check state matches
  │ 4. POST /auth/google {code, codeVerifier, redirectUri, timezone} ─▶
  │                                     5. POST oauth2.googleapis.com/token ─▶
  │                                        (code, verifier, client_secret)
  │                                     ◀── { id_token, … } ───────────────────
  │                                     6. decode id_token; check iss, aud = CLIENT_ID,
  │                                        exp, email_verified
  │                                     7. upsert learner by google_sub
  │                                     8. issue access JWT + new refresh family
  │ ◀── {accessToken, refreshToken, expiresIn, learner} ──
```

- **Why the backend exchanges the code:** the Google client secret stays on the server, and only `openid email profile` is requested. The Google access token is thrown away; Voca never calls Google APIs on the user's behalf.
- **ID token signature (step 6):** OIDC Core §3.1.3.7 allows TLS server validation to replace signature checking when the ID token comes directly from the token endpoint over TLS. Voca still checks `iss`, `aud`, `exp`, and `email_verified`. This avoids fetching Google's JWKS.
- **Registration is the first sign-in.** There is no separate signup.

## Tokens

| | Access token | Refresh token |
|---|---|---|
| Format | JWT, HS256, signed with `jose` | 32 random bytes, base64url. Opaque, not a JWT |
| Claims | `sub` (the learner's 8-character slug; JWTs are readable, so the internal ID is never placed in one), `iat`, `exp`, `iss: "voca"`, `aud: "voca-web"` | — |
| Lifetime | 15 min | 30 days, sliding (renewed on every rotation) |
| Stored by the server | Nothing (stateless) | `sha256(token)`, `family_id`, `expires_at`, `used_at`, `revoked_at` |
| Stored by the client | **Memory only** (module variable) | `localStorage` |
| Sent as | `Authorization: Bearer` | JSON body to `/auth/refresh` |

Verification only accepts `algorithms: ["HS256"]`, and checks issuer and audience. Because the algorithm is fixed, `alg: none` and algorithm-confusion attacks are rejected.

The auth middleware resolves `sub` to the internal `learners.id` with one indexed lookup (`WHERE slug = $1`) per request. It provides the result as a `CurrentLearner` service to handlers.

### JWT or PASETO?

The recommendation is **JWT**.

PASETO v4 is a cleaner format with no algorithm choice to get wrong. However, JavaScript PASETO libraries see little maintenance (check `paseto` on npm before choosing it). `jose` is actively maintained and has zero dependencies. Pinning the algorithm closes the main JWT weakness. There is also only one service, so it shares a single HMAC secret; asymmetric keys would add nothing.

## Refresh rotation with reuse detection (FR-10)

```
POST /auth/refresh {refreshToken}
  row = SELECT … WHERE token_hash = sha256(token) FOR UPDATE
  ├─ none / expired / revoked          → 401 RefreshTokenInvalid
  ├─ row.used_at IS NOT NULL (reuse!)  → UPDATE … SET revoked_at = now() WHERE family_id = row.family_id
  │                                      → 401 RefreshTokenInvalid   (attacker or victim both forced to re-login)
  └─ ok → UPDATE row SET used_at = now();
          INSERT new token (same family_id, expires_at = now() + 30d)
          → {accessToken, refreshToken}
```

- **Concurrent refreshes from several tabs:** without coordination, two tabs would refresh with the same token and trigger reuse detection. The frontend prevents this with the native **Web Locks API**: `navigator.locks.request("voca-refresh", …)`. Only one tab refreshes at a time. The others then read the new token from `localStorage` and receive a `storage` event.
- **Logout** revokes the token's family.
- **Purge:** `DELETE FROM refresh_tokens WHERE expires_at < now() - interval '7 days'`, run on boot and every 24 hours by an Effect `Schedule` inside the API process. No cron job is needed.

## Frontend handling
- The API client wraps each request: if a call returns `401 Unauthorized`, it refreshes once and retries once. If the refresh fails, it clears storage and goes to `/login`.
- A refresh is also started proactively when `exp − now < 60 s`.

## Trade-off of not using cookies (accepted)

A refresh token in `localStorage` can be read by any script that runs on the page (XSS). An `HttpOnly` cookie would hide it from scripts, but the requirement is to avoid cookies. Mitigations:

1. **A strict CSP** in `fe/public/_headers`:
   ```
   default-src 'self'; script-src 'self'; connect-src 'self' https://api…; img-src 'self' https://*.googleusercontent.com; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
   ```
   It allows no third-party scripts and no inline scripts.
2. **React escaping.** `dangerouslySetInnerHTML` is never used, and readings are rendered as `<ruby>` elements, not as HTML strings.
3. **Rotation and reuse detection**, which limit how long a stolen token is useful.
4. **A short access-token lifetime** (15 min).
