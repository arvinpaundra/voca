// Same-origin proxy for /api/* to the cluster origin. Runs only on Cloudflare Pages.
type Env = { API_ORIGIN: string; ORIGIN_SECRET: string }

export const onRequest = ({ request, env }: { request: Request; env: Env }) => {
  const url = new URL(request.url)
  const upstream = new Request(env.API_ORIGIN + url.pathname + url.search, request)

  // Traefik keys its rate limit on X-Real-IP, so a client must never set it, or X-Forwarded-For, itself.
  upstream.headers.delete("X-Forwarded-For")
  upstream.headers.set("X-Real-IP", request.headers.get("CF-Connecting-IP") ?? "")

  // The origin route matches only with this header: proof the request came through this function.
  upstream.headers.set("X-Voca-Origin", env.ORIGIN_SECRET)

  return fetch(upstream)
}
