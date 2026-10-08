// Same-origin RSS preview proxy for the existing Cloudflare Worker deployment.
// The default path remains static assets. No admin routes or user credentials are forwarded.
const UPSTREAM = "https://reeferreview-rss-preview.onrender.com";

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    const news = incoming.pathname === "/v1/news" || incoming.pathname.startsWith("/v1/news/");
    if (!news) return env.ASSETS.fetch(request);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }

    const target = new URL(UPSTREAM);
    target.pathname = incoming.pathname;
    target.search = incoming.search;
    const headers = new Headers({ Accept: "application/json" });
    for (const key of ["if-none-match", "if-modified-since"]) {
      const value = request.headers.get(key);
      if (value) headers.set(key, value);
    }
    try {
      const response = await fetch(target, { method: request.method, headers, redirect: "manual" });
      const publicHeaders = new Headers({
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      for (const key of ["content-type", "etag", "last-modified"]) {
        const value = response.headers.get(key);
        if (value) publicHeaders.set(key, value);
      }
      if (response.status >= 300 && response.status < 400) {
        return new Response("Upstream redirect refused", { status: 502, headers: publicHeaders });
      }
      return new Response(request.method === "HEAD" ? null : response.body, {
        status: response.status, headers: publicHeaders,
      });
    } catch {
      return new Response(JSON.stringify({ error: "NEWS_UPSTREAM_UNAVAILABLE" }), {
        status: 502,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
  },
};
