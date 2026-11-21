// Only the existing BongGoggles /social-api/* Cloudflare route should use
// this Worker. The registered Render hostname is the TLS/HTTP upstream;
// the Go backend verifies the separate 256-bit Worker secret.
const SITE = "bonggoggles.420integrated.org";
const UPSTREAM = "https://bonggoggles-social.onrender.com";
const PATH_PREFIX = "/social-api/";
const secretPattern = /^[A-Za-z0-9_-]{43}$/;

// Render's free tier can take about a minute to restart after sleeping.
// Only the safe, no-query GET /auth/start browser navigation may retry. Never
// retry a callback code, logout or mutation; those can be single-use.
const LOGIN_PATH = "/social-api/auth/start";
const WAKE_COOKIE = "bg_social_wake";
const MAX_WAKE_CHECKS = 8;
const WAKE_DELAY_SECONDS = 12;
function wakeCount(request) {
 const cookie = request.headers.get("Cookie") ?? "";
 const match = cookie.match(/(?:^|;\s*)bg_social_wake=(\d+)(?:;|$)/);
 return match ? Math.min(MAX_WAKE_CHECKS, Number(match[1])) : 0;
}
function wakingResponse(request) {
 const count = wakeCount(request) + 1;
 const auto = count < MAX_WAKE_CHECKS;
 const refresh = auto ? '<meta http-equiv="refresh" content="12;url=/social-api/auth/start">' : '';
 const message = auto ?
  'The account service is waking up. This page will retry sign-in automatically.' :
  'The service is still unavailable. Return to BongGoggles and try sign-in again after it recovers.';
 const body = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  refresh+'<title>Starting BongGoggles sign-in</title>'+
  '<style>body{background:#09251a;color:#eefcf1;font:16px system-ui,sans-serif;max-width:38rem;margin:10vh auto;padding:2rem;line-height:1.6}h1{font-size:1.6rem}a{display:inline-block;background:#b1e7bd;color:#082614;border-radius:8px;padding:.65rem 1rem;margin-right:.5rem}a:focus-visible{outline:3px solid #ffdc75;outline-offset:2px}</style></head><body>'+
  '<h1>BongGoggles sign-in temporarily unavailable</h1><p>'+message+'</p>'+
  '<p>Your 420ID account is not changed, and no wallet is needed.</p>'+
  '<a href="/social">Return to BongGoggles</a><a href="/social-api/auth/start">Try sign-in</a></body></html>';
 const headers = new Headers({
  "Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store",
  "Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff",
  "X-Frame-Options":"DENY",
  "Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Retry-After":String(WAKE_DELAY_SECONDS),
  "Set-Cookie":WAKE_COOKIE+"="+Math.min(MAX_WAKE_CHECKS,count)+"; Max-Age=180; Path="+LOGIN_PATH+"; Secure; HttpOnly; SameSite=Lax"
 });
 return new Response(body,{status:503,headers});
}

function reply(status, error) {
 return Response.json({error},{status,headers:{"Cache-Control":"no-store"}});
}

export async function forwardSocialRequest(request, env, fetchImpl = fetch) {
 const url = new URL(request.url);
 if (url.protocol !== "https:" || url.host !== SITE ||
     !url.pathname.startsWith(PATH_PREFIX) ||
     url.pathname.includes("%") || url.pathname.includes("//") ||
     url.pathname.includes("\\") ||
     !["GET","HEAD","POST","PUT","DELETE"].includes(request.method)) {
  return reply(404,"Not Found");
 }
 // This binding must be added as a Worker SECRET, never a public variable or
 // a browser runtime-config property. The backend independently validates it.
 if (!secretPattern.test(env?.SOCIAL420_EDGE_SECRET ?? "")) {
  return reply(503,"Trusted social proxy not configured");
 }
 const target = new URL(UPSTREAM);
 target.pathname = url.pathname;
 target.search = url.search;
 const headers = new Headers(request.headers);
 headers.delete("host");
 headers.delete("content-length");
 headers.delete("x-forwarded-host");
 headers.delete("x-social420-edge-key"); // ignore any client-supplied credential
 headers.set("x-social420-edge-key",env.SOCIAL420_EDGE_SECRET);
 headers.set("x-forwarded-proto","https");
 try {
  const upstream = new Request(target.toString(), {
   method:request.method,
   headers,
   body:["GET","HEAD"].includes(request.method)?undefined:request.body,
   duplex:"half",
   redirect:"manual"
  });
  const origin = await fetchImpl(upstream);
  // Render responds with 502/503 while a free instance is sleeping. Only
  // the browser's safe login-start navigation receives a bounded wake page.
  const isLoginStart = request.method==="GET" && url.pathname===LOGIN_PATH && !url.search;
  if (isLoginStart && [502,503,504].includes(origin.status)) {
   await origin.body?.cancel();
   return wakingResponse(request);
  }
  // Preserve origin Set-Cookie and Location without rewriting them.
  const outgoing = new Response(origin.body,origin);
  if (isLoginStart && origin.status===303) {
   outgoing.headers.append("Set-Cookie",WAKE_COOKIE+"=; Max-Age=0; Path="+LOGIN_PATH+"; Secure; HttpOnly; SameSite=Lax");
  }
  outgoing.headers.set("Cache-Control","no-store");
  outgoing.headers.delete("Access-Control-Allow-Origin");
  outgoing.headers.delete("Access-Control-Allow-Credentials");
  return outgoing;
 } catch {
  if (request.method==="GET" && url.pathname===LOGIN_PATH && !url.search) {
   return wakingResponse(request);
  }
  return reply(502,"Social service unavailable");
 }
}

export default {
 fetch(request,env) {
  return forwardSocialRequest(request,env);
 }
};
