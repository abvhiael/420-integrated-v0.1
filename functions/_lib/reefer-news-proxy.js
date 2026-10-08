// Cloudflare Pages same-origin, read-only proxy to the standalone RSS backend.
// No configurable public origin, credential forwarding, or admin API exposure.
const ORIGIN = "https://reeferreview-rss-preview.onrender.com";
const PREFIX = "/v1/news";

export async function proxyReeferNews({ request }) {
  const incoming = new URL(request.url);
  if (!(incoming.pathname === PREFIX || incoming.pathname.startsWith(PREFIX + "/"))) {
    return new Response("Not found", { status: 404 });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }

  const destination = new URL(ORIGIN);
  destination.pathname = incoming.pathname;
  destination.search = incoming.search;
  const headers = new Headers({ Accept: "application/json" });
  for (const name of ["if-none-match", "if-modified-since"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const upstream = await fetch(destination.toString(), {
      method: request.method,
      headers,
      redirect: "manual",
    });
    const responseHeaders = new Headers({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    for (const name of ["content-type", "etag", "last-modified"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    // Never relay upstream redirects or authorization/cookie headers.
    if (upstream.status >= 300 && upstream.status < 400) {
      return new Response("Upstream redirect refused", { status: 502, headers: responseHeaders });
    }
    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return new Response(JSON.stringify({ error: "NEWS_UPSTREAM_UNAVAILABLE" }), {
      status: 502,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
}
