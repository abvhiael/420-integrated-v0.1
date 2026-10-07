import {clientState} from "./state.js";
import {createApiClient,ApiError} from "./api-client.js";

const $=(id)=>document.getElementById(id);
let runtime;
let api;

const safeText=(value)=>String(value??"");
const setOutput=(id,message,error=false)=>{
  const el=$(id); if(!el)return;
  el.textContent=safeText(message);
  el.classList.toggle("error",Boolean(error));
};
const generationOf=(data)=>Number.isSafeInteger(data?.authorityGeneration)?data.authorityGeneration:clientState.authorityGeneration;

async function guarded(action,outputId){
  try{return await action();}
  catch(error){
    if(error instanceof ApiError && (error.status===401||error.status===403||error.status===409||error.status===410)){
      clientState.clearDerived();
    }
    setOutput(outputId,error?.message||"Request denied",true);
    return null;
  }
}

function renderCards(id,items,kind){
  const root=$(id);root.replaceChildren();
  for(const item of items||[]){
    const card=document.createElement("article");card.className="card";
    const h=document.createElement("h3");h.textContent=safeText(item.displayName||item.label||"Profile");
    card.append(h);
    if(item.summary){const p=document.createElement("p");p.textContent=safeText(item.summary);card.append(p)}
    if(kind==="discovery"){
      for(const action of ["LIKE","PASS"]){
        const b=document.createElement("button");b.type="button";b.textContent=action==="LIKE"?"Like":"Pass";
        b.addEventListener("click",()=>relationship(item.profileId,action));
        card.append(b);
      }
    }
    if(kind==="match"){
      const msg=document.createElement("button");msg.type="button";msg.textContent="Open messaging";
      msg.addEventListener("click",()=>openMessenger(item.profileId));card.append(msg);
      const unmatch=document.createElement("button");unmatch.type="button";unmatch.textContent="Unmatch";
      unmatch.addEventListener("click",()=>safety(item.profileId,"UNMATCH",{}));card.append(unmatch);
    }
    root.append(card);
  }
  if(!root.children.length){const p=document.createElement("p");p.textContent="No current results.";root.append(p)}
}

async function relationship(profileId,action){
  const data=await guarded(()=>api.relationshipAction(profileId,action),"entry-output");
  if(!data)return;
  clientState.applyAuthorityGeneration(generationOf(data));
  setOutput("entry-output",safeText(data.message||`${action} recorded.`));
  await loadDiscovery();
}

async function safety(profileId,action,details){
  const data=await guarded(()=>api.safetyAction(profileId,action,details),"safety-output");
  if(!data)return;
  clientState.applyAuthorityGeneration(generationOf(data));
  setOutput("safety-output",safeText(data.message||`${action} accepted.`));
}

async function openMessenger(profileId){
  const data=await guarded(()=>api.messengerEntry(profileId),"entry-output");
  if(!data)return;
  clientState.applyAuthorityGeneration(generationOf(data));
  if(data.allowed!==true || typeof data.entryRef!=="string") {
    setOutput("entry-output","Messaging entry denied.",true);return;
  }
  const url=new URL(runtime.messengerEntry,location.origin);
  url.searchParams.set("entry",data.entryRef);
  location.assign(url.href);
}

async function loadVerification(){
  const data=await guarded(()=>api.verification(),"profile-output");if(!data)return;
  clientState.applyAuthorityGeneration(generationOf(data));
  const root=$("verification-badges");root.replaceChildren();
  for(const label of data.indicators||[]){const span=document.createElement("span");span.className="chip";span.textContent=safeText(label);root.append(span)}
}

async function loadDiscovery(){
  const data=await guarded(()=>api.discovery(),"entry-output");if(!data)return;
  clientState.cacheDiscovery(data.items||[],generationOf(data));
  renderCards("discovery-cards",clientState.discovery,"discovery");
}
async function loadMatches(){
  const data=await guarded(()=>api.matches(),"entry-output");if(!data)return;
  clientState.cacheMatches(data.items||[],generationOf(data));
  renderCards("match-list",clientState.matches,"match");
}

async function boot(){
  runtime=await fetch("./runtime-config.json",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject(new Error("runtime config unavailable")));
  if(runtime.deploymentStatus!=="repository-qualified-not-deployed") throw new Error("unexpected deployment status");
  api=createApiClient({apiBase:runtime.apiBase,tokenProvider:()=>clientState.sessionToken});
  setOutput("runtime-status","Repository-qualified client loaded. No live deployment is claimed.");
}
boot().catch(e=>setOutput("runtime-status",e.message,true));

$("connect-session").addEventListener("click",()=>{clientState.setSessionToken($("session-token").value);$("session-token").value="";setOutput("entry-output","Session held in memory. Revalidation required for protected actions.")});
$("clear-session").addEventListener("click",()=>{clientState.clearSession();$("session-token").value="";setOutput("entry-output","Signed out; derived client state cleared.")});

$("check-session").addEventListener("click",()=>guarded(async()=>{
  const data=await api.session();clientState.applyAuthorityGeneration(generationOf(data));setOutput("entry-output",safeText(data.status||"Session current."));
},"entry-output"));

$("check-eligibility").addEventListener("click",()=>guarded(async()=>{
  const data=await api.eligibility();clientState.applyAuthorityGeneration(generationOf(data));clientState.eligibility=data;
  setOutput("entry-output",safeText(data.state||"Eligibility checked."));
},"entry-output"));

$("load-profile").addEventListener("click",()=>guarded(async()=>{
  const data=await api.profile();clientState.applyAuthorityGeneration(generationOf(data));clientState.profile=data.profile||null;
  setOutput("profile-output",clientState.profile?"Profile loaded.":"No profile returned.");
  await loadVerification();
},"profile-output"));

$("profile-form").addEventListener("submit",(ev)=>{ev.preventDefault();guarded(async()=>{
  const data=Object.fromEntries(new FormData(ev.currentTarget));
  const out=await api.saveProfile(data);clientState.applyAuthorityGeneration(generationOf(out));
  setOutput("profile-output","Profile saved after server authorization.");
},"profile-output")});

$("upload-media").addEventListener("click",()=>guarded(async()=>{
  const file=$("profile-media").files?.[0];
  if(!file) throw new Error("Choose a JPEG, PNG or WebP profile photo first.");
  const data=await api.uploadMedia(file);clientState.applyAuthorityGeneration(generationOf(data));
  $("profile-media").value="";setOutput("profile-output","Profile photo uploaded after server authorization.");
},"profile-output"));

$("refresh-discovery").addEventListener("click",loadDiscovery);
$("refresh-matches").addEventListener("click",loadMatches);

$("refresh-notifications").addEventListener("click",()=>guarded(async()=>{
  const data=await api.notifications();clientState.cacheNotifications(data.items||[],generationOf(data));
  setOutput("notification-list",clientState.notifications.map(x=>safeText(x.label||x.kind)).join("\n")||"No current notifications.");
},"notification-list"));

$("safety-form").addEventListener("submit",(ev)=>{ev.preventDefault();const f=new FormData(ev.currentTarget);
  safety(f.get("profileId"),f.get("action"),{note:f.get("details")||""});
});
$("visibility-form").addEventListener("submit",(ev)=>{ev.preventDefault();guarded(async()=>{
  const f=new FormData(ev.currentTarget);const data=await api.visibility(f.get("visibility"));
  clientState.applyAuthorityGeneration(generationOf(data));setOutput("settings-output","Visibility updated.");
},"settings-output")});
$("lifecycle-form").addEventListener("submit",(ev)=>{ev.preventDefault();guarded(async()=>{
  const f=new FormData(ev.currentTarget);const data=await api.lifecycle(f.get("action"));
  clientState.applyAuthorityGeneration(generationOf(data));setOutput("settings-output",safeText(data.state||"Lifecycle updated."));
},"settings-output")});
$("check-deletion").addEventListener("click",()=>guarded(async()=>{
  const data=await api.deletionStatus();clientState.applyAuthorityGeneration(generationOf(data));
  setOutput("settings-output",safeText(data.state||"Deletion status unavailable."));
},"settings-output"));

$("refresh-premium").addEventListener("click",()=>guarded(async()=>{
  const data=await api.premium();clientState.applyAuthorityGeneration(generationOf(data));clientState.premium=data.features||[];
  const root=$("premium-list");root.replaceChildren();
  for(const feature of clientState.premium){const span=document.createElement("span");span.className="chip";span.textContent=safeText(feature);root.append(span)}
  if(!root.children.length)root.textContent="No active premium features.";
},"premium-list"));

