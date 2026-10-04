const API_PREFIX = "/v1/";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin"
};

function withSecurity(response, isAsset = false) {
  const out = new Response(response.body, response);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) out.headers.set(key, value);
  if (isAsset) {
    out.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; object-src 'none'"
    );
  }
  return out;
}

export function validOrigin(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost")) return false;
    return true;
  } catch {
    return false;
  }
}

function unavailable() {
  return withSecurity(new Response(JSON.stringify({
    canonical: false,
    error: "ORIGIN_NOT_CONFIGURED",
    message: "The public 420Analytics backend is not connected yet."
  }), {
    status: 503,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  }));
}

async function proxyAnalytics(request, env) {
  if (!validOrigin(env.ANALYTICS_ORIGIN)) return unavailable();

  const incoming = new URL(request.url);
  const base = new URL(env.ANALYTICS_ORIGIN);
  const target = new URL(incoming.pathname + incoming.search, base);

  const headers = new Headers();
  headers.set("accept", request.headers.get("accept") || "application/json");
  headers.set("user-agent", "420Integrated-Analytics-Edge/1");

  let response;
  try {
    response = await fetch(target, {
      method: request.method,
      headers,
      redirect: "manual"
    });
  } catch {
    return withSecurity(new Response(JSON.stringify({
      canonical: false,
      error: "ANALYTICS_ORIGIN_UNAVAILABLE",
      message: "The 420Analytics origin is unavailable."
    }), {
      status: 502,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    }));
  }

  const out = new Response(response.body, response);
  out.headers.set("cache-control", "no-store");
  out.headers.delete("set-cookie");
  out.headers.set("x-420-edge", "cloudflare-worker");
  return withSecurity(out);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return withSecurity(new Response("method not allowed", {
        status: 405,
        headers: { allow: "GET, HEAD" }
      }));
    }

    if (url.pathname.startsWith(API_PREFIX) || url.pathname === "/health" || url.pathname === "/ready") {
      return proxyAnalytics(request, env);
    }

    const response = await env.ASSETS.fetch(request);
    const out = withSecurity(response, true);

    if (/\.(?:css|js|mjs|svg|png|ico)$/i.test(url.pathname)) {
      out.headers.set("cache-control", "public, max-age=3600, stale-while-revalidate=86400");
    } else {
      out.headers.set("cache-control", "no-cache");
    }
    return out;
  }
};

export { proxyAnalytics };
