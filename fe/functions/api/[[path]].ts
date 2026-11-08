// Same-origin proxy for /api/* to the cluster origin. Runs only on Cloudflare Pages.
export const onRequest = ({ request, env }: { request: Request; env: { API_ORIGIN: string } }) => {
  const url = new URL(request.url);
  const upstream = new Request(env.API_ORIGIN + url.pathname + url.search, request);
  upstream.headers.set("X-Real-IP", request.headers.get("CF-Connecting-IP") ?? "");
  return fetch(upstream);
};
