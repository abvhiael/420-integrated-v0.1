const API_PREFIX = "/v1/";

function securityHeaders(headers) {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  return headers;
}

function errorResponse(status, code, message) {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: securityHeaders(new Headers({
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }))
  });
}

function validatedOrigin(raw) {
  if (!raw) throw new Error("EXPLORER_ORIGIN is not configured");
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("EXPLORER_ORIGIN must use https");
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error("EXPLORER_ORIGIN must not target a loopback host");
  }
  url.pathname = url.pathname.replace(/\/$/, "");
  return url;
}

async function proxyApi(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "420Explorer public API is read-only");
  }

  let origin;
  try {
    origin = validatedOrigin(env.EXPLORER_ORIGIN);
  } catch (error) {
    return errorResponse(503, "ORIGIN_NOT_CONFIGURED", error.message);
  }

  const incoming = new URL(request.url);
  const upstream = new URL(origin.toString());
  upstream.pathname = origin.pathname + incoming.pathname;
  upstream.search = incoming.search;

  const headers = new Headers(request.headers);
  headers.delete("cookie");
  headers.delete("authorization");
  headers.set("accept", "application/json");
  headers.set("x-420-edge", "cloudflare-worker");
  headers.set("x-forwarded-host", incoming.host);

  let response;
  try {
    response = await fetch(new Request(upstream, {
      method: request.method,
      headers,
      redirect: "manual"
    }));
  } catch {
    return errorResponse(502, "EXPLORER_ORIGIN_UNAVAILABLE", "420Explorer origin is unavailable");
  }

  const responseHeaders = securityHeaders(new Headers(response.headers));
  responseHeaders.set("cache-control", "no-store");
  responseHeaders.set("x-420-edge", "cloudflare-worker");
  responseHeaders.delete("set-cookie");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith(API_PREFIX)) {
      return proxyApi(request, env);
    }

    const response = await env.ASSETS.fetch(request);
    const headers = securityHeaders(new Headers(response.headers));
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
    );

    if (/\.(?:css|js|mjs|svg)$/i.test(url.pathname)) {
      headers.set("cache-control", "public, max-age=3600, stale-while-revalidate=86400");
    } else {
      headers.set("cache-control", "no-cache");
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};

export { validatedOrigin, proxyApi };
