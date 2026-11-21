# 12 — Deployment

## Topology

```
Browser ──▶ https://voca.arvinpaundra.dev  (Cloudflare, one origin)
              ├─ /*      ─▶ Cloudflare Pages: fe static SPA
              └─ /api/*  ─▶ Pages Function fe/functions/api/[[path]].ts
                              └─ fetch ─▶ https://voca-origin.arvinpaundra.dev (Cloudflare-proxied)
                                            ─▶ kube-oci Traefik ─▶ ns voca: voca-api (Bun, routes under /api)
                                                                       │
                                                                       ▼
                                            ns database: postgres-postgresql (PostgreSQL 18.3)
```

**Status:** released by `.github/workflows/release.yml` (below). Before the first release, the owner works through the [first-release checklist](#first-release-checklist).

## Frontend: Cloudflare Pages
- Custom domain: `voca.arvinpaundra.dev`.
- Build: `bun install && bun run --filter @voca/fe build` produces `fe/dist`.
- `fe/public/_redirects`: `/*  /index.html  200` (SPA fallback). Pages Functions take precedence, so `/api/*` never hits the fallback.
- `fe/public/_headers`: the CSP from [08](08-auth.md), plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and long-lived caching for `/assets/*`.
- Deployed by the release with `wrangler pages deploy`; `fe/wrangler.toml` holds the project name and `API_ORIGIN`.
- Build-time environment: `VITE_GOOGLE_CLIENT_ID`. There is no API URL: the client calls relative `/api` paths.
- Google Cloud Console: authorized redirect URIs `https://voca.arvinpaundra.dev/auth/callback` and `http://localhost:5173/auth/callback`.

### The `/api` proxy (Pages Function)

```ts
// fe/functions/api/[[path]].ts: same-origin proxy to the cluster
export const onRequest = ({ request, env }: { request: Request; env: { API_ORIGIN: string } }) => {
  const url = new URL(request.url)
  const upstream = new Request(env.API_ORIGIN + url.pathname + url.search, request)
  upstream.headers.set("X-Real-IP", request.headers.get("CF-Connecting-IP") ?? "")
  return fetch(upstream)
}
```

- `API_ORIGIN = https://${API_HOST}` is a Pages variable in `fe/wrangler.toml`; the release fills in `API_HOST` from the GitHub variable.
- **Client IP:** Traefik sees Cloudflare's addresses, so the rate limit is keyed on `X-Real-IP` (`sourceCriterion.requestHeaderName`). Someone calling the origin host directly could spoof it; accepted for the MVP, and fixable by locking the origin to Cloudflare later.
- **Cost ceiling:** each API call is one Worker request. The free plan allows 100k a day, about 2,500 daily learners at ~40 calls each. Beyond that, Workers Paid is $5/month for 10M requests.
- **Local development:** `vite.config.ts` sets `server.proxy: { "/api": "http://localhost:8000" }`, so local paths match production.

## Backend: kube-oci

### Image
`be/Containerfile`: `bun build --compile` produces a single self-contained binary with no `node_modules` at runtime, on `alpine` with `libstdc++` (the binary links it), run as UID 10001. The image is about 100 MB.

The node `mio-vnc` is **arm64**. The release builds the image on GitHub's `ubuntu-24.04-arm` runner; locally, `podman build --platform linux/arm64 -f be/Containerfile .` works natively on Apple Silicon.

### Manifests (`deploy/k8s/`, plain YAML)
| File | Content |
|---|---|
| `namespace.yaml` | `voca` |
| `secret.yaml` | `voca-api` with `${DATABASE_URL}`, `${JWT_SECRET}`, `${GOOGLE_CLIENT_ID}`, `${GOOGLE_CLIENT_SECRET}` placeholders, filled in by the release with `envsubst` from GitHub secrets |
| `deployment.yaml` | 1 replica, rolling (below); resources `requests: 100m/128Mi`, `limits: 512Mi`; readiness and liveness probes on `GET /api/healthz`; `runAsNonRoot`, `readOnlyRootFilesystem` (with an `emptyDir` on `/tmp`); a 10 s `preStop` sleep. `IMAGE` and `RELEASE` are filled in by the release |
| `service.yaml` | ClusterIP 80 → 8000 |
| `ingress.yaml` | Traefik, external-dns with Cloudflare proxying; host `${API_HOST}` (`voca-origin.arvinpaundra.dev`) and target `${API_TARGET_IP}`, filled in by the release from GitHub variables. It is reached only by the Pages Function; browsers use `voca.arvinpaundra.dev/api` |
| `ratelimit.yaml` | A Traefik `Middleware` (`rateLimit`: average 10 req/s, burst 20, keyed on `X-Real-IP`) attached to the ingress |

There is no Helm or Kustomize for 6 files.

**Migrations** never run at boot. Every release runs them before the rollout, as a one-off pod `voca-migrate` on the release's own image (`voca-api migrate`, env from the `voca-api` secret). The `effect/sql` Migrator applies only what is pending, so a release without a new migration changes nothing, and it takes a lock, so two runs at once are safe. A failed migration fails the release before the rollout, and the running version keeps serving.

**Rollout** (ADR 53): `RollingUpdate` with `maxSurge: 1`, `maxUnavailable: 0`. The old pod serves until the new one is ready; the `preStop` sleep takes a stopping pod out of the endpoints before SIGTERM. For that moment the old version runs against the new schema, so **every migration must work with the previous release**: add first, remove in a later release. During a rollout two pods hold up to 20 database connections.

### Database (existing `database/postgres-postgresql`)
Postgres 18.3. The `voca` database and role are created once (checklist step 5); the API reaches it at `postgres-postgresql.database.svc.cluster.local:5432/voca`.

**Backups:** if none exist, add a `CronJob` that runs `pg_dump voca | gzip` to OCI Object Storage. Recommended, but outside the MVP code.

## Release (ADR 54)

The owner pushes a tag `vX.Y.Z` on a master commit. Nothing else deploys. `.github/workflows/release.yml`, one run at a time:

Master is protected by the required `verify` check, so a master commit has already passed it; tag only after master's CI has finished.

1. **image:** built on an arm64 runner, pushed to `ghcr.io/arvinpaundra/voca-api:<tag>`.
2. **secret:** `secret.yaml` is filled in from the GitHub secrets on every run (values masked in logs).
3. **migrate:** the pending migrations, from the release's image (above). A failure stops the release here.
4. **rollout:** the manifests are applied with the tag's image; `kubectl rollout status --timeout=180s`. A pod that never becomes ready is undone with `kubectl rollout undo` (it never served), and the run fails; the previous pod served throughout. A release that became healthy is never rolled back automatically.
5. **web:** only after the API is healthy: `vite build` (with `VITE_GOOGLE_CLIENT_ID`) and `wrangler pages deploy` from `fe/` (`fe/wrangler.toml` holds the project name and `API_ORIGIN`), tagged with the commit hash.

**Roll back:** re-run the older tag's release run (GitHub allows it for 30 days), or *Actions → release → Run workflow* with that tag. Migrations are not reversed, which is why they stay backward compatible.

**GitHub repository secrets:**

| Secret | Value |
|---|---|
| `KUBECONFIG` | base64 of a kubeconfig holding only the `kube-oci` context, set as its current context |
| `DATABASE_URL` | `postgres://voca:<password>@postgres-postgresql.database.svc.cluster.local:5432/voca`, set by the owner; the only place the `voca` role's password lives |
| `JWT_SECRET` | at least 32 random bytes |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | the Google OAuth client; the ID is also built into the web app |
| `CLOUDFLARE_API_TOKEN` | a token with *Cloudflare Pages: Edit* |
| `CLOUDFLARE_ACCOUNT_ID` | the account that holds the Pages project |

**GitHub repository variables:**

| Variable | Value |
|---|---|
| `API_HOST` | `voca-origin.arvinpaundra.dev` |
| `API_TARGET_IP` | `140.245.111.204` |

## First-release checklist

One-time steps only the owner does, in order. Steps 2–4 cannot be undone, and step 2 takes `vocaapi.arvinpaundra.dev` offline for good.

1. **Cluster context:** `kubectl config use-context kube-oci`, before any command below.
2. **Remove the old Voca from the cluster.** Note the old database name and role first, from `DB_DSN`:
   ```bash
   kubectl -n voca get secret voca-api-secret -o jsonpath='{.data.DB_DSN}' | base64 -d; echo
   kubectl delete namespace voca   # deployment voca-api-deployment, service, ingress voca-api-ingress, secret voca-api-secret, configmap voca-api-config
   kubectl get all,ingress,secret,configmap -A | grep -i voca-api   # expect nothing
   ```
3. **DNS:** Cloudflare → `arvinpaundra.dev` → DNS → delete the `vocaapi` record if external-dns left it. `dig +short vocaapi.arvinpaundra.dev` must print nothing.
4. **Old database:** `kubectl -n database exec -it postgres-postgresql-0 -- psql -U postgres`, then `DROP DATABASE <old_db>; DROP ROLE <old_role>;` (names from step 2). `\l` and `\du` must no longer list them. Nothing moves to the new app.
5. **Fresh database**, in the same `psql`; check `SHOW max_connections;` leaves room for 20 more:
   ```sql
   CREATE ROLE voca LOGIN PASSWORD '<the password in DATABASE_URL>';
   CREATE DATABASE voca OWNER voca;
   REVOKE ALL ON DATABASE voca FROM PUBLIC;
   ```
6. **Google OAuth:** Google Cloud Console → Credentials → the OAuth client → authorized redirect URIs `https://voca.arvinpaundra.dev/auth/callback` and `http://localhost:5173/auth/callback`; remove the old app's URIs.
7. **GitHub secrets and variables:** repo → Settings → Secrets and variables → Actions, every secret and variable in the tables above. The kubeconfig:
   ```bash
   kubectl config view --minify --flatten --context kube-oci | base64 | gh secret set KUBECONFIG
   ```
8. **Cloudflare Pages:** `bunx wrangler@4.20.0 pages project create voca --production-branch master`, then Pages → voca → Custom domains → add `voca.arvinpaundra.dev`. The `voca-origin` record is created by external-dns from the ingress on the first release.
9. **First release:** `git tag v1.0.0 origin/master && git push origin v1.0.0`. It migrates the fresh database itself. GHCR makes a new package private: if the migrate step times out on `ImagePullBackOff`, set *Packages → voca-api → Package settings → visibility* to Public and re-run the release.
