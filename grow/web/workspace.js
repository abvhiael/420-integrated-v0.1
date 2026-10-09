const SECTIONS=Object.freeze(["overview","facilities","plants","environment","equipment","cultivation","harvests","inventory","advice","notifications"]);
const MAX=500;
export function endpoint(config,pageOrigin){
 if(!config||config.enabled!==true||typeof config.privateApiBaseUrl!=="string")return null;
 try{
  const url=new URL(config.privateApiBaseUrl);
  if(url.protocol!=="https:"||url.username||url.password||url.search||url.hash||url.pathname!=="/")return null;
  if(url.origin!==pageOrigin&&!config.crossOriginApproved)return null;
  return url.origin;
 }catch{return null;}
}
export function validateSession(session){
 if(!session||session.version!=="grow-private-v1"||session.authenticated!==true||
 typeof session.tenantId!=="string"||!session.tenantId||
 typeof session.subjectId!=="string"||!session.subjectId||
 !Array.isArray(session.sections)||!session.sections.every(x=>SECTIONS.includes(x))||
 new Set(session.sections).size!==session.sections.length||
 !session.expiresAt||!Number.isFinite(Date.parse(session.expiresAt))||Date.parse(session.expiresAt)<=Date.now())throw Error("Session unavailable");
 return Object.freeze({tenantId:session.tenantId,subjectId:session.subjectId,sections:[...session.sections],expiresAt:session.expiresAt});
}
export function validatePage(payload,section,session){
 if(!session?.sections.includes(section)||!payload||payload.version!=="grow-private-v1"||
 payload.tenantId!==session.tenantId||payload.section!==section||
 !Array.isArray(payload.items)||payload.items.length>MAX||
 !payload.items.every(x=>x&&typeof x.id==="string"&&x.id&&typeof x.title==="string"&&x.title.length<=160&&
 typeof x.summary==="string"&&x.summary.length<=1000&&x.tenantId===session.tenantId&&
 (x.state===undefined||typeof x.state==="string"&&x.state.length<=60)))throw Error("Private response rejected");
 if(new Set(payload.items.map(x=>x.id)).size!==payload.items.length)throw Error("Duplicate private records");
 return payload.items.map(x=>({id:x.id,title:x.title,summary:x.summary,state:x.state||""}));
}
export async function fetchPrivate(config,pageOrigin,fetcher=fetch){
 const origin=endpoint(config,pageOrigin);
 if(!origin)throw Error("Private API not configured");
 const request=async path=>{
  const r=await fetcher(origin+path,{method:"GET",credentials:"include",mode:"cors",redirect:"error",cache:"no-store",
   headers:{Accept:"application/json"},signal:AbortSignal.timeout(10000)});
  if(!r.ok||!r.headers.get("content-type")?.toLowerCase().startsWith("application/json"))throw Error("Private API unavailable");
  const text=await r.text();
  if(text.length>1048576)throw Error("Private response too large");
  return JSON.parse(text);
 };
 const session=validateSession(await request("/v1/private/session"));
 return {session,request};
}
export function boot(doc=globalThis.document,win=globalThis.window){
 if(!doc||!win)return;
 const root=doc.getElementById("workspace"),status=doc.getElementById("workspace-status"),
 nav=doc.getElementById("workspace-nav"),heading=doc.getElementById("section-heading"),
 refresh=doc.getElementById("workspace-refresh");
 if(!root||!status||!nav||!heading||!refresh)return;
 let api=null,selected="",generation=0;
 const report=text=>{status.textContent=text;};
 function lock(text){
  generation++;api=null;selected="";nav.replaceChildren();root.replaceChildren();heading.textContent="Private workspace";refresh.disabled=true;report(text);
 }
 async function display(section){
  const current=++generation;selected=section;
  root.replaceChildren();heading.textContent=section[0].toUpperCase()+section.slice(1);report("Loading authorized records…");
  try{
   if(!api||!api.session.sections.includes(section))throw Error("Section not authorized");
   const records=validatePage(await api.request("/v1/private/dashboard/"+encodeURIComponent(section)),section,api.session);
   if(current!==generation)return;
   if(!records.length){report("No records available for this section.");return;}
   for(const record of records){
    const card=doc.createElement("article");card.className="workspace-card";
    const h=doc.createElement("h3");h.textContent=record.title;
    const p=doc.createElement("p");p.textContent=record.summary;
    card.append(h,p);
    if(record.state){const small=doc.createElement("small");small.textContent=record.state;card.append(small);}
    root.append(card);
   }
   report(records.length+" authorized records. Read-only dashboard; no equipment commands are available.");
  }catch{
   if(current!==generation)return;
   lock("Private data unavailable or session expired. Sign in again through the authorized cultivation service.");
  }
 }
 async function connect(){
  lock("Checking private API and session…");
  try{
   const instance=await fetchPrivate(win.GROW420_PRIVATE_CONFIG,win.location.origin);
   api=instance;nav.replaceChildren();
   for(const section of api.session.sections){
    const button=doc.createElement("button");button.type="button";button.textContent=section;
    button.addEventListener("click",()=>display(section));nav.append(button);
   }
   refresh.disabled=false;
   if(api.session.sections.length)await display(api.session.sections[0]);
   else report("Your account has no authorized dashboard sections.");
  }catch{lock("Private workspace unavailable. No public directory identity grants access to cultivation data.");}
 }
 refresh.addEventListener("click",()=>selected?display(selected):connect());
 connect();
}
if(typeof window!=="undefined"&&typeof document!=="undefined")boot();
