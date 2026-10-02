const SECURITY_HEADERS={
  "X-Content-Type-Options":"nosniff",
  "Referrer-Policy":"no-referrer",
  "Permissions-Policy":"camera=(), microphone=(), geolocation=(), payment=()",
  "Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; object-src 'none'",
  "Cross-Origin-Opener-Policy":"same-origin"
};

export function validOrigin(value){
  if(!value)return false;
  try{
    const u=new URL(value);
    if(u.protocol!=="https:"||u.username||u.password)return false;
    const h=u.hostname.toLowerCase();
    if(h==="localhost"||h==="127.0.0.1"||h==="::1"||h.endsWith(".localhost"))return false;
    return true;
  }catch{return false}
}

function withSecurity(response){
  const out=new Response(response.body,response);
  for(const [k,v] of Object.entries(SECURITY_HEADERS))out.headers.set(k,v);
  return out;
}

function unavailable(){
  return withSecurity(new Response(JSON.stringify({
    canonical:false,
    error:"ORIGIN_NOT_CONFIGURED",
    message:"The public 420Status backend is not connected yet."
  }),{status:503,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}}));
}

async function proxyStatus(request,env){
  if(!validOrigin(env.STATUS_ORIGIN))return unavailable();
  const incoming=new URL(request.url);
  const targetBase=new URL(env.STATUS_ORIGIN);
  const target=new URL(incoming.pathname+incoming.search,targetBase);
  const headers=new Headers();
  headers.set("accept",request.headers.get("accept")||"application/json");
  headers.set("user-agent","420Integrated-Status-Edge/1");
  const response=await fetch(target,{method:request.method,headers,redirect:"manual"});
  const out=new Response(response.body,response);
  out.headers.set("cache-control","no-store");
  return withSecurity(out);
}

export default{
  async fetch(request,env){
    const url=new URL(request.url);
    if(request.method!=="GET"&&request.method!=="HEAD"){
      return withSecurity(new Response("method not allowed",{status:405,headers:{allow:"GET, HEAD"}}));
    }
    if(url.pathname.startsWith("/v1/")||url.pathname==="/healthz"||url.pathname==="/readyz"){
      return proxyStatus(request,env);
    }
    return withSecurity(await env.ASSETS.fetch(request));
  }
};
