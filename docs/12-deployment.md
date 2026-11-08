# 12 — Deployment

## Topology

```
Browser ──▶ Cloudflare Pages (fe, static SPA)  https://voca.<domain>
   │
   └─ fetch Bearer ─▶ Cloudflare proxy ─▶ kube-oci (k3s, single node mio-vnc)
                                            Traefik ingress ─▶ ns voca: voca-api (Bun)
                                                                  │
                                                                  ▼
                                            ns database: postgres-postgresql (existing Helm release)
```

## Frontend: Cloudflare Pages
- Build: `bun install && bun run --filter @voca/fe build` produces `fe/dist`.
- `fe/public/_redirects`: `/*  /index.html  200` (SPA fallback).
- `fe/public/_headers`: the CSP from [08](08-auth.md), plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and long-lived caching for `/assets/*`.
- Build-time environment: `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID`.
- Google Cloud Console: add `https://<pages-domain>/auth/callback` (and `http://localhost:5173/auth/callback`) as authorized redirect URIs.

## Backend: kube-oci

### Image
```dockerfile
FROM oven/bun:1.3-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY contract/package.json contract/
COPY be/package.json be/
RUN bun install --frozen-lockfile --production --filter @voca/be
COPY contract contract
COPY be be
RUN bun build be/src/main.ts --compile --minify --target=bun-linux-arm64-musl --outfile /voca-api

FROM alpine:3.22
RUN adduser -D -u 10001 app
COPY --from=build /voca-api /voca-api
USER 10001
EXPOSE 3000
ENTRYPOINT ["/voca-api"]
```

`--compile` produces a single self-contained binary with no `node_modules` at runtime, so the image is about 60 MB.

The node `mio-vnc` is **arm64** (verified: 4 vCPU, 24 GiB RAM, about 20% memory in use). Build the image with `docker buildx --platform linux/arm64`, which works natively on Apple Silicon.

### Manifests (`deploy/k8s/`, plain YAML)
| File | Content |
|---|---|
| `namespace.yaml` | `voca` |
| `secret.example.yaml` | `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (the real values are applied by hand and never committed) |
| `deployment.yaml` | 1 replica; resources `requests: 100m/128Mi`, `limits: 512Mi`; `readinessProbe` and `livenessProbe` on `GET /healthz`; `securityContext` with `runAsNonRoot` and `readOnlyRootFilesystem`; config from env vars (`WEB_ORIGIN`, `LOG_LEVEL`) |
| `service.yaml` | ClusterIP 80 → 3000 |
| `ingress.yaml` | Traefik, with the same `external-dns` and Cloudflare-proxied annotations as the current deployment; host `vocaapi.arvinpaundra.dev` (or a new one, see [13](13-decisions.md)) |
| `ratelimit.yaml` | A Traefik `Middleware` (`rateLimit`: average 10 req/s, burst 20) attached to the ingress |

There is no Helm or Kustomize for 6 files. `kubectl apply -f deploy/k8s/` is enough.

**Migrations** run at boot through the `@effect/sql` Migrator, which takes a lock. Readiness stays false until they finish. There is no separate migration Job.

**Rollout:** the deployment uses `strategy: Recreate`, since there is 1 replica and migrations run at boot. That means a few seconds of downtime on deploy, which is acceptable for an MVP. Switch to `RollingUpdate` and 2 replicas once migrations are always backward compatible.

### Database (existing `database/postgres-postgresql`)
This is a one-time manual step run with admin credentials:

```sql
CREATE ROLE voca LOGIN PASSWORD '<generated>';
CREATE DATABASE voca OWNER voca;
REVOKE ALL ON DATABASE voca FROM PUBLIC;
```

Then:

```
DATABASE_URL=postgres://voca:<pw>@postgres-postgresql.database.svc.cluster.local:5432/voca
```

Before the first deploy, also check:
- **Postgres version:** 13 or later is required ([06](06-data-model.md)).
- **`max_connections` headroom** for 10 more connections.
- **Backups:** if none exist, add a `CronJob` that runs `pg_dump voca | gzip` to OCI Object Storage. Recommended, but outside the MVP code.

## Cleaning up the current Voca deployment in kube-oci

I inspected the cluster **read-only** on 2026-11-08. Nothing has been deleted yet.

| Kind | Name | Notes |
|---|---|---|
| Namespace | `voca` | Created 237 days ago |
| Deployment | `voca-api-deployment` (1/1 running, plus 3 old ReplicaSets) | The current API is serving traffic |
| Service | `voca-api-service` | ClusterIP :80 |
| Ingress | `voca-api-ingress` | Host `vocaapi.arvinpaundra.dev`; external-dns with Cloudflare proxying |
| Secret | `voca-api-secret` | Keys: `DB_DSN`, `FRONTEND_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `JWT_SECRET_KEY` |
| ConfigMap | `voca-api-config` | `APP_MODE=production` |
| Postgres | Database and role inside `database/postgres-postgresql` | **Not verified.** Listing databases was blocked by permissions. The `DB_DSN` key shows the old app uses that Postgres |

Proposed cleanup, to run **only after you confirm** and after the new API is ready to deploy:

```bash
# 0. (optional) keep the Google OAuth client — it can be reused if its redirect URIs are updated
kubectl --context kube-oci -n voca get secret voca-api-secret -o jsonpath='{.data.GOOGLE_CLIENT_ID}' | base64 -d

# 1. remove the old app (namespace delete removes deployment, svc, ingress, secret, configmap;
#    external-dns then removes the DNS record if its policy is `sync`)
kubectl --context kube-oci delete namespace voca

# 2. drop the old database (find its name from DB_DSN first; back it up if it has data you want)
kubectl --context kube-oci -n database exec -it postgres-postgresql-0 -- psql -U postgres
#   \l                                -- identify the old voca DB + role
#   DROP DATABASE <old_voca_db>; DROP ROLE <old_voca_role>;
```

Steps 1 and 2 cannot be undone. Step 1 also takes `vocaapi.arvinpaundra.dev` offline until the new API is deployed.
