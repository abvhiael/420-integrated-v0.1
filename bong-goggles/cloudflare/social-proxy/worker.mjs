// Only the existing BongGoggles /social-api/* Cloudflare route should use
// this Worker. The registered Render hostname is the TLS/HTTP upstream;
// the Go backend verifies the separate 256-bit Worker secret.
const SITE = "bonggoggles.420integrated.org";
const UPSTREAM = "https://bonggoggles-social.onrender.com";
const PATH_PREFIX = "/social-api/";
const secretPattern = /^[A-Za-z0-9_-]{43}$/;

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
  const upstream = new Request(target, {
   method:request.method,
   headers,
   body:["GET","HEAD"].includes(request.method)?undefined:request.body,
   duplex:"half",
   redirect:"manual"
  });
  const origin = await fetchImpl(upstream);
  // Preserve origin Set-Cookie and Location without rewriting them.
  const outgoing = new Response(origin.body,origin);
  outgoing.headers.set("Cache-Control","no-store");
  outgoing.headers.delete("Access-Control-Allow-Origin");
  outgoing.headers.delete("Access-Control-Allow-Credentials");
  return outgoing;
 } catch {
  return reply(502,"Social service unavailable");
 }
}

export default {
 fetch(request,env) {
  return forwardSocialRequest(request,env);
 }
};
