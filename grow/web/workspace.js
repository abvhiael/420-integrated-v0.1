const SECTIONS=Object.freeze(["overview","facilities","plants","environment","equipment","cultivation","harvests","inventory","advice","notifications"]);
const MAX=500;
const ACTION_FIELDS=Object.freeze({
 "facilities.create":["kind","label","parentId","facilityId"],"facilities.rename":["kind","id","label","revision"],
 "plants.create":["facilityId","zoneId","label","state"],"plants.transition":["id","state","revision"],
 "cultivation.record":["facilityId","zoneId","kind","metric","unit","amount","reason"],
 "harvests.record":["facilityId","zoneId","sourceId","amount"],
 "inventory.create":["facilityId","zoneId","kind","unit","label","amount"],
 "inventory.adjust":["facilityId","zoneId","sourceId","kind","amount","reason"],
 "inventory.export":["facilityId","zoneId","sourceId","jurisdiction"],
 "advice.review":["facilityId","zoneId","sourceId","state","reason"]
});
const SELECT_VALUES=Object.freeze({
 "facilities.create.kind":["FACILITY","ROOM","ZONE"],"facilities.rename.kind":["FACILITY","ROOM","ZONE"],
 "plants.create.state":["SEED","CLONE"],"plants.transition.state":["VEGETATIVE","FLOWERING","HARVESTED","RETIRED"],
 "cultivation.record.kind":["NUTRIENT","IRRIGATION","ENVIRONMENT"],
 "cultivation.record.metric":["NUTRIENT_EC","NUTRIENT_PH","NUTRIENT_VOLUME","IRRIGATION_VOLUME","ENV_TEMPERATURE","ENV_HUMIDITY"],
 "cultivation.record.unit":["mS/cm","pH","L","C","%"],
 "inventory.create.kind":["SEED","CLONE","INPUT","MATERIAL","EQUIPMENT","HARVEST"],
 "inventory.create.unit":["each","g","kg","L","mL"],
 "inventory.adjust.kind":["RECEIVE","ADJUST_IN","ISSUE","CONSUME","ADJUST_OUT"],
 "inventory.export.jurisdiction":["GENERIC","CA-SK","CA-AB","CA-NS","CA-ON"],
 "advice.review.state":["ACCEPTED_FOR_REVIEW","REJECTED"]
});

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
 !session.expiresAt||!Number.isFinite(Date.parse(session.expiresAt))||Date.parse(session.expiresAt)<=Date.now()||
 typeof session.csrf!=="string"||!/^[a-f0-9]{64}$/.test(session.csrf)||
 !Array.isArray(session.actions)||!session.actions.every(v=>typeof v==="string"&&Object.hasOwn(ACTION_FIELDS,v)&&session.sections.includes(v.split(".")[0]))||
 new Set(session.actions).size!==session.actions.length)throw Error("Session unavailable");
 return Object.freeze({tenantId:session.tenantId,subjectId:session.subjectId,sections:[...session.sections],actions:[...session.actions],csrf:session.csrf,expiresAt:session.expiresAt});
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
 const post=async(path,payload)=>{
  const response=await fetcher(origin+path,{method:"POST",credentials:"include",mode:"cors",redirect:"error",cache:"no-store",
   headers:{"Content-Type":"application/json","X-CSRF-Token":session.csrf,Accept:"text/csv, application/json"},
   body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error("Private action denied");
  if(response.status===204)return {success:true};
  if(response.headers.get("content-type")?.toLowerCase().startsWith("text/csv")){
   const csv=await response.text();
   if(csv.length>1048576)throw Error("Export exceeds limit");
   return {csv};
  }
  throw Error("Unexpected action result");
 };
 const logout=async()=>fetcher(origin+"/v1/private/logout",{method:"POST",credentials:"include",
  mode:"cors",redirect:"error",cache:"no-store",headers:{"X-CSRF-Token":session.csrf},
  signal:AbortSignal.timeout(10000)});
 return {session,request,post,logout};
}
export function boot(doc=globalThis.document,win=globalThis.window){
 if(!doc||!win)return;
 const root=doc.getElementById("workspace"),status=doc.getElementById("workspace-status"),
 nav=doc.getElementById("workspace-nav"),heading=doc.getElementById("section-heading"),
 refresh=doc.getElementById("workspace-refresh"),logoutButton=doc.getElementById("workspace-logout"),
 loginButton=doc.getElementById("workspace-login");
 if(!root||!status||!nav||!heading||!refresh)return;
 let api=null,selected="",generation=0;
 const report=text=>{status.textContent=text;};
 function lock(text){
  generation++;api=null;selected="";if(logoutButton)logoutButton.hidden=true;if(loginButton)loginButton.hidden=false;nav.replaceChildren();root.replaceChildren();heading.textContent="Private workspace";refresh.disabled=true;report(text);
 }

 function forms(section){
  if(!api)return;
  const allowed=api.session.actions.filter(v=>v.startsWith(section+"."));
  if(!allowed.length)return;
  const group=doc.createElement("section");group.className="workspace-forms";
  const title=doc.createElement("h3");title.textContent="Authorized workflows";group.append(title);
  for(const action of allowed){
   const fields=ACTION_FIELDS[action];if(!fields)continue;
   const form=doc.createElement("form");form.className="workspace-action";
   const heading=doc.createElement("h4");heading.textContent=action.split(".")[1].replaceAll("_"," ");form.append(heading);
   for(const field of fields){
    const id="grow-"+action.replace(".","-")+"-"+field;
    const wrapper=doc.createElement("label");wrapper.textContent=field.replace(/([A-Z])/g," $1");
    let input;const values=SELECT_VALUES[action+"."+field];
    if(values){
     input=doc.createElement("select");
     const placeholder=doc.createElement("option");placeholder.value="";placeholder.textContent="Select…";input.append(placeholder);
     for(const value of values){const opt=doc.createElement("option");opt.value=value;opt.textContent=value;input.append(opt);}
    }else{
     input=doc.createElement("input");
     input.type=field==="amount"||field==="revision"?"number":"text";
     if(field==="amount"){input.min="0";input.step="any";}
     if(field==="revision"){input.min="1";input.step="1";}
     input.maxLength=field==="reason"?1000:160;
    }
    input.id=id;input.name=field;
    input.required=!(field==="reason"||field==="parentId"||field==="facilityId"&&action==="facilities.create");
    wrapper.append(input);form.append(wrapper);
   }
   const button=doc.createElement("button");button.type="submit";
   button.textContent=action.endsWith(".export")?"Generate internal CSV":"Submit "+action.split(".")[1];
   form.append(button);
   form.addEventListener("submit",async event=>{
    event.preventDefault();button.disabled=true;
    const data={operation:action.split(".")[1],requestId:win.crypto?.randomUUID?.()};
    for(const field of fields){
     const value=form.elements.namedItem(field)?.value??"";
     if(value!=="")data[field]=field==="amount"||field==="revision"?Number(value):value;
    }
    try{
     if(!data.requestId)throw Error("Secure request identifier unavailable");
     const result=await api.post("/v1/private/action/"+section,data);
     if(result.csv){
      const blob=new Blob([result.csv],{type:"text/csv;charset=utf-8"});
      const href=URL.createObjectURL(blob);
      const link=doc.createElement("a");link.href=href;link.download="grow-inventory-internal.csv";link.click();
      URL.revokeObjectURL(href);
     }
     report("Action accepted. Reloading authorized records…");
     await display(section);
    }catch{report("Action denied or unavailable. No mutation was confirmed.");}
    finally{button.disabled=false;}
   });
   group.append(form);
  }
  root.append(group);
 }

 async function display(section){
  const current=++generation;selected=section;
  root.replaceChildren();heading.textContent=section[0].toUpperCase()+section.slice(1);report("Loading authorized records…");
  try{
   if(!api||!api.session.sections.includes(section))throw Error("Section not authorized");
   const records=validatePage(await api.request("/v1/private/dashboard/"+encodeURIComponent(section)),section,api.session);
   if(current!==generation)return;
   if(!records.length){report("No records available for this section.");forms(section);return;}
   for(const record of records){
    const card=doc.createElement("article");card.className="workspace-card";
    const h=doc.createElement("h3");h.textContent=record.title;
    const p=doc.createElement("p");p.textContent=record.summary;
    card.append(h,p);
    if(record.state){const small=doc.createElement("small");small.textContent=record.state;card.append(small);}
    root.append(card);
   }
   forms(section);
   report(records.length+" authorized records. No autonomous equipment commands are available.");
  }catch{
   if(current!==generation)return;
   lock("Private data unavailable or session expired. Sign in again through the authorized cultivation service.");
  }
 }
 async function connect(){
  lock("Checking private API and session…");
  try{
   const instance=await fetchPrivate(win.GROW420_PRIVATE_CONFIG,win.location.origin);
   api=instance;if(logoutButton)logoutButton.hidden=false;if(loginButton)loginButton.hidden=true;nav.replaceChildren();
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
 if(loginButton)loginButton.addEventListener("click",async()=>{
  loginButton.disabled=true;
  try{
   const origin=endpoint(win.GROW420_PRIVATE_CONFIG,win.location.origin);
   if(!origin||origin!==win.location.origin)throw Error("Same-origin TLS required");
   const result=await win.fetch(origin+"/v1/private/login",{method:"POST",credentials:"include",redirect:"error",cache:"no-store"});
   if(!result.ok)throw Error("Certificate not approved");
   await connect();
  }catch{lock("Certificate login unavailable. Enroll a verified identity with the operator.");}
  finally{loginButton.disabled=false;}
 });
 if(logoutButton)logoutButton.addEventListener("click",async()=>{
  const current=api;lock("Signing out…");
  try{if(!current)throw Error("No session");const response=await current.logout();
   if(!response.ok)throw Error("Logout not confirmed");report("Signed out. Private session revoked.");
  }catch{report("Private workspace locked; server-side session revocation could not be confirmed.");}
 });
 connect();
}
if(typeof window!=="undefined"&&typeof document!=="undefined")boot();
