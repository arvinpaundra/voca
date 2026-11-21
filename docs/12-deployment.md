# 12 — Deployment

## Topology

```
Browser ──▶ https://voca.arvinpaundra.dev  (Cloudflare, one origin)
              ├─ /*      ─▶ Cloudflare Pages: fe static SPA
              └─ /api/*  ─▶ Pages Function fe/functions/api/[[path]].ts
                              └─ fetch + X-Voca-Origin ─▶ https://voca-origin.arvinpaundra.dev (Cloudflare-proxied)
                                            ─▶ kube-oci Traefik: route needs the secret header ─▶ Cloudflare IPs only
                                               ─▶ rate limit ─▶ ns voca: voca-api (Bun, routes under /api)
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

`fe/functions/api/[[path]].ts` forwards the request to `API_ORIGIN` after three header changes: it deletes `X-Forwarded-For`, sets `X-Real-IP` from `CF-Connecting-IP`, and adds `X-Voca-Origin: <ORIGIN_SECRET>`.

- `API_ORIGIN = https://voca-origin.arvinpaundra.dev` is a Pages variable, set in `fe/wrangler.toml`. `ORIGIN_SECRET` is a Pages secret, set by the release from the GitHub secret.

### Origin protection (ADR 55)
Three layers, in Traefik's order:
1. **Origin secret:** the `IngressRoute` matches only `Host(voca-origin…) && Header(X-Voca-Origin, <secret>)`. Any other request matches no route and gets Traefik's 404. This is what proves a request came from the Pages Function; Cloudflare's addresses alone don't, since any Cloudflare customer can send from them.
2. **Cloudflare only:** the `cloudflare` middleware (`ipAllowList`) refuses any TCP peer outside Cloudflare's ranges with 403. It needs Traefik's Service on `externalTrafficPolicy: Local` (`traefik-config.yaml`), otherwise Traefik sees the node's address.
3. **Rate limit:** `ratelimit` (10 req/s, burst 20, per `X-Real-IP`). The header is trusted only because layer 1 already passed. Counters are in Traefik's memory; with one Traefik replica that is exact.

Traefik's `forwardedHeaders.trustedIPs` is Cloudflare's ranges on both entry points, so `X-Forwarded-*` from anyone else is dropped. The Cloudflare ranges are copied into `cloudflare.yaml` and `traefik-config.yaml` from cloudflare.com/ips; they change rarely and are updated by hand.

**Edge rate limit (Cloudflare):** one rule on `voca.arvinpaundra.dev/api/*` keyed on the visitor IP, set in the dashboard (checklist step 8). Voca has no password login or reset (Google OAuth only), so one rule covers it; the free plan allows one rule with a 10 s window.
- **Cost ceiling:** each API call is one Worker request. The free plan allows 100k a day, about 2,500 daily learners at ~40 calls each. Beyond that, Workers Paid is $5/month for 10M requests.
- **Local development:** `vite.config.ts` sets `server.proxy: { "/api": "http://localhost:8000" }`, so local paths match production.

## Backend: kube-oci

### Image
`be/Containerfile`: `bun build --compile` produces a single self-contained binary with no `node_modules` at runtime, on `alpine` with `libstdc++` (the binary links it), run as UID 10001. The image is about 100 MB.

The node `mio-vnc` is **arm64**. The release builds the image on GitHub's `ubuntu-24.04-arm` runner; locally, `podman build --platform linux/arm64 -f be/Containerfile .` works natively on Apple Silicon.

### Manifests (`deploy/k8s/`, plain YAML)
| File | Content |
|---|---|
| `setup.yaml` | Applied once by the owner: namespace `voca`, ServiceAccount `voca-deployer` with its token, and a Role limited to the namespace (deployments, jobs, secrets, services, Traefik routes and middlewares; read pods, events, logs) |
| `traefik-config.yaml` | Applied once by the owner: a k3s `HelmChartConfig` for the bundled Traefik, `externalTrafficPolicy: Local` and Cloudflare as trusted proxies |
| `secret.example.yaml` | The shape of `voca-api`: `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Never applied; the release builds the real one from GitHub secrets |
| `deployment.yaml` | 1 replica, rolling (below); resources `requests: 100m/128Mi`, `limits: 512Mi`; readiness and liveness probes on `GET /api/healthz`; `runAsNonRoot`, `readOnlyRootFilesystem` (with an `emptyDir` on `/tmp`); a 10 s `preStop` sleep. `IMAGE` (an image digest) and `RELEASE` are filled in by the release |
| `migrate-job.yaml` | `voca-api migrate` on the release's image digest; `backoffLimit: 0`, `activeDeadlineSeconds: 170` |
| `service.yaml` | ClusterIP 80 → 8000 |
| `ingressroute.yaml` | Traefik `IngressRoute` on `voca-origin.arvinpaundra.dev`, matching only with the origin secret header (`ORIGIN_SECRET` filled in by the release); middlewares `cloudflare`, `ratelimit` |
| `cloudflare.yaml` | `ipAllowList` of Cloudflare's ranges |
| `ratelimit.yaml` | `rateLimit`: 10 req/s, burst 20, keyed on `X-Real-IP` |

There is no Helm or Kustomize for these files. The `voca-origin` DNS record is created by hand once (external-dns here reads only `Ingress`, not `IngressRoute`).

**Migrations** run in the `voca-migrate` Job, before the rollout, on the same image digest (`voca-api migrate`). The server never migrates. The `effect/sql` Migrator takes a lock, so two runs at once are safe. A failed Job stops the release before any pod runs the new code.

**Rollout** (ADR 53): `RollingUpdate` with `maxSurge: 1`, `maxUnavailable: 0`. The old pod serves until the new one is ready; the `preStop` sleep takes a stopping pod out of the endpoints before SIGTERM. For that moment the old version runs against the new schema, so **every migration must work with the previous release**: add first, remove in a later release. During a rollout two pods hold up to 20 database connections.

### Database (existing `database/postgres-postgresql`)
Postgres 18.3. The `voca` database and role are created once (checklist step 5); the API reaches it at `postgres-postgresql.database.svc.cluster.local:5432/voca`.

**Backups:** none, by the owner's decision (2026-11-21).

## Release (ADR 54)

The owner pushes a tag `vX.Y.Z` on a master commit. Nothing else deploys. `.github/workflows/release.yml`, one run at a time:

1. **gate:** the tag is `vX.Y.Z`, its commit is on `origin/master`, and that commit's latest `verify` check-run concluded `success`. Otherwise the run fails here and nothing is deployed. Tag only after master's CI has finished.
2. **image:** built on an arm64 runner, pushed to `ghcr.io/arvinpaundra/voca-api:<tag>`. Every later step uses its digest (`…@sha256:…`), never the tag.
3. **kubeconfig:** the `voca-deployer` ServiceAccount's, which can touch only the `voca` namespace.
4. **secret:** `voca-api` is rebuilt from the GitHub secrets on every run (values masked in logs).
5. **migrate:** the `voca-migrate` Job runs on the digest; its logs are printed. If it fails, the run fails and nothing rolls out.
6. **rollout:** the manifests are applied with the digest; `kubectl rollout status --timeout=180s`. A pod that never becomes ready is undone with `kubectl rollout undo` (it never served), and the run fails; the previous pod served throughout. A release that became healthy is never rolled back automatically.
7. **web:** only after the API is healthy: `vite build` (with `VITE_GOOGLE_CLIENT_ID`), `ORIGIN_SECRET` set on the Pages project, and `wrangler pages deploy` from `fe/`, tagged with the commit hash. A failed web step leaves the new API serving the previous web app; re-run the job.
8. **smoke:** `GET https://voca.arvinpaundra.dev/api/healthz` must answer 204 (the whole path down to `SELECT 1`), and the origin called without the secret must answer 404.

Third-party actions are pinned to full commit SHAs. A failed run is GitHub's own notification (an email to the owner).

**Roll back:** re-run the older tag's release run (GitHub allows it for 30 days), or *Actions → release → Run workflow* with that tag. Migrations are not reversed, which is why they stay backward compatible.

**GitHub repository secrets:**

| Secret | Value |
|---|---|
| `KUBECONFIG` | base64 of the `voca-deployer` kubeconfig (checklist step 7) |
| `ORIGIN_SECRET` | 32 random bytes as hex (`openssl rand -hex 32`); hex only, since the release substitutes it with `sed` |
| `DATABASE_URL` | `postgres://voca:<pw>@postgres-postgresql.database.svc.cluster.local:5432/voca` |
| `JWT_SECRET` | at least 32 random bytes |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | the Google OAuth client; the ID is also built into the web app |
| `CLOUDFLARE_API_TOKEN` | a token with *Cloudflare Pages: Edit* |
| `CLOUDFLARE_ACCOUNT_ID` | the account that holds the Pages project |

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
   CREATE ROLE voca LOGIN PASSWORD '<generated>';
   CREATE DATABASE voca OWNER voca;
   REVOKE ALL ON DATABASE voca FROM PUBLIC;
   ```
6. **Google OAuth:** Google Cloud Console → Credentials → the OAuth client → authorized redirect URIs `https://voca.arvinpaundra.dev/auth/callback` and `http://localhost:5173/auth/callback`; remove the old app's URIs.
7. **Cluster setup and GitHub secrets.** Apply the one-time manifests (with your own admin context), then build the deployer's kubeconfig from its token:
   ```bash
   kubectl apply -f deploy/k8s/setup.yaml -f deploy/k8s/traefik-config.yaml
   kubectl -n kube-system get svc traefik -o jsonpath='{.spec.externalTrafficPolicy}'; echo   # expect Local once k3s redeploys Traefik

   server=$(kubectl config view --minify --context kube-oci -o jsonpath='{.clusters[0].cluster.server}')
   kubectl -n voca get secret voca-deployer-token -o jsonpath='{.data.ca\.crt}' | base64 -d > /tmp/voca-ca.crt
   token=$(kubectl -n voca get secret voca-deployer-token -o jsonpath='{.data.token}' | base64 -d)
   K=/tmp/voca-deployer.kubeconfig
   kubectl --kubeconfig $K config set-cluster kube-oci --server "$server" --certificate-authority /tmp/voca-ca.crt --embed-certs
   kubectl --kubeconfig $K config set-credentials voca-deployer --token "$token"
   kubectl --kubeconfig $K config set-context voca-deployer --cluster kube-oci --user voca-deployer --namespace voca
   kubectl --kubeconfig $K --context voca-deployer auth can-i patch deployments -n voca   # yes
   kubectl --kubeconfig $K --context voca-deployer auth can-i get pods -n kube-system     # no
   base64 < $K | gh secret set KUBECONFIG
   openssl rand -hex 32 | gh secret set ORIGIN_SECRET
   rm $K /tmp/voca-ca.crt
   ```
   Then repo → Settings → Secrets and variables → Actions, every other secret in the table above.
   Protect release tags: repo → Settings → Rules → Rulesets → New tag ruleset, target `v*`, rules *Restrict creations*, *Restrict updates*, *Restrict deletions*, with yourself as the only bypass.
8. **Cloudflare:** `bunx wrangler@4.20.0 pages project create voca --production-branch master`, then Pages → voca → Custom domains → add `voca.arvinpaundra.dev`. DNS → add `A voca-origin 140.245.111.204`, proxied. Security → WAF → Rate limiting rules: one rule, *URI Path starts with `/api/`* on `voca.arvinpaundra.dev`, per IP, about 100 requests per minute (on the free plan: 20 per 10 s), action *Block*.
9. **First release:** `git tag v1.0.0 origin/master && git push origin v1.0.0`. GHCR makes a new package private: if the migrate Job or the rollout fails with `ImagePullBackOff`, set *Packages → voca-api → Package settings → visibility* to Public and re-run the release. If the smoke step gets 403 through the proxy, Traefik isn't seeing Cloudflare's addresses: check step 7's `externalTrafficPolicy`.
