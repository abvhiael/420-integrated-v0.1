// Operator-only protected console. Never render raw route, location, contact or payment data.
export function mountOperatorConsole(container,session,sessionProvider,{origin=globalThis.location?.origin,fetchImpl=globalThis.fetch,nonce=()=>globalThis.crypto?.randomUUID?.()}={}){
 const root=document.createElement('section');root.className='panel';root.setAttribute('aria-label','Operator dispatch and safety console');
 const heading=document.createElement('h2');heading.textContent='Operator dispatch, eligibility and incidents';
 const input=document.createElement('input');input.setAttribute('aria-label','Trip ID to inspect');input.placeholder='Trip reference';input.maxLength=128;input.required=true;input.pattern='[A-Za-z0-9_-]{1,128}';
 const load=document.createElement('button');load.type='button';load.textContent='Verify dispatch and eligibility';
 const incidents=document.createElement('button');incidents.type='button';incidents.textContent='Review incident cases';
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const summary=document.createElement('p');const incidentsList=document.createElement('ul');
 const caseInput=document.createElement('input');caseInput.setAttribute('aria-label','Incident ID to resolve');caseInput.placeholder='Verified incident ID';caseInput.maxLength=128;caseInput.required=true;caseInput.pattern='[A-Za-z0-9_-]{1,128}';
 const resolution=document.createElement('select');resolution.setAttribute('aria-label','Safety recovery decision');
 for(const key of ['safe_exit','interrupted']){const o=document.createElement('option');o.value=key;o.textContent=key;resolution.append(o);}
 const recover=document.createElement('button');recover.type='button';recover.textContent='Resolve verified active-trip incident';
 const note=document.createElement('p');note.textContent='Operator actions require server permission and an immutable audit. Trip status is not live until independently verified.';
 root.append(heading,input,load,incidents,status,summary,incidentsList,caseInput,resolution,recover,note);container.append(root);
 let active=true,busy=false,current=null,caseIds=new Set(),pending=null;
 const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
 const operator=()=>session?.status==='authenticated'&&session.roles?.includes('operator')&&id(session.subject);
 const controls=()=>{load.disabled=busy||!operator();incidents.disabled=busy||!current;recover.disabled=busy||!current||current.state!=='IN_PROGRESS'||!caseIds.has(caseInput.value.trim());};
 input.addEventListener('input',()=>input.removeAttribute('aria-invalid'));
 caseInput.addEventListener('input',()=>caseInput.removeAttribute('aria-invalid'));
 const reset=()=>{current=null;pending=null;caseIds.clear();summary.textContent='';incidentsList.replaceChildren();controls();};
 async function call(tripId,tail='',body){
  if(!operator()||!id(tripId)||!origin||typeof fetchImpl!=='function'||typeof sessionProvider?.getAccessToken!=='function')throw Error('OPERATOR_UNAVAILABLE');
  const token=await sessionProvider.getAccessToken();
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))throw Error('AUTH_UNAVAILABLE');
  const url=new URL('/v1/rideshare/operator/trips/'+tripId+tail,origin);
  if(url.origin!==origin)throw Error('ORIGIN_DENIED');
  const res=await fetchImpl(url,{method:body?'POST':'GET',credentials:'omit',cache:'no-store',redirect:'error',
   headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(!res.ok)throw Error('AUTHORITY_UNAVAILABLE');return res.json();
 }
 async function run(work){
  if(busy||!active)return;busy=true;controls();status.textContent='Verifying independent operator authority…';
  try{await work();status.textContent='Confirmed by authenticated operator service.';}
  catch{reset();status.textContent='Operator operation unverified, denied or stale. No recovery is assumed.';}
  finally{busy=false;if(active)controls();}
 }
 load.addEventListener('click',()=>void run(async()=>{
  const idValue=input.value.trim();if(!id(idValue)){input.setAttribute('aria-invalid','true');input.focus();throw Error('INVALID_TRIP_ID');}reset();
  const result=await call(idValue);
  if(result?.trip?.tripId!==idValue||!Number.isSafeInteger(result.trip.revision)||!['REQUESTED','ASSIGNED','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED'].includes(result.trip.state)||
    !['PENDING','ACCEPTED','ARRIVED','CLOSED','NONE'].includes(result.dispatch?.status)||
    !['ELIGIBLE','REVOKED','EXPIRED','PENDING','UNKNOWN'].includes(result.eligibility?.status))throw Error('INVALID_PROJECTION');
  current={id:idValue,state:result.trip.state,revision:result.trip.revision};
  summary.textContent='Trip '+idValue+': '+current.state+' (revision '+current.revision+'), dispatch '+result.dispatch.status+', eligibility '+result.eligibility.status+'. Preview only; no live service.';
 }));
 incidents.addEventListener('click',()=>void run(async()=>{
  if(!current)throw Error('NO_TRIP');const data=await call(current.id,'/incidents');
  if(data?.tripId!==current.id||!Array.isArray(data.incidents)||data.incidents.length>100)throw Error('INVALID_INCIDENTS');
  caseIds.clear();incidentsList.replaceChildren();
  for(const row of data.incidents){if(!id(row.incidentId)||!['medical','collision','threat','vehicle','other'].includes(row.category))throw Error('INVALID_INCIDENT');
   caseIds.add(row.incidentId);const li=document.createElement('li');li.textContent='Incident '+row.incidentId+' ('+row.category+')';incidentsList.append(li);}
 }));
 recover.addEventListener('click',()=>void run(async()=>{
  if(!id(caseInput.value.trim())){caseInput.setAttribute('aria-invalid','true');caseInput.focus();throw Error('INVALID_INCIDENT_ID');}
  if(!current||current.state!=='IN_PROGRESS'||!caseIds.has(caseInput.value.trim()))throw Error('RECOVERY_DENIED');
  const incidentId=caseInput.value.trim(),choice=resolution.value;
  if(!pending){const commandId=nonce();if(!id(commandId))throw Error('NO_SECURE_NONCE');pending={commandId,incidentId,expectedRevision:current.revision,resolution:choice};}
  if(pending.incidentId!==incidentId||pending.resolution!==choice||pending.expectedRevision!==current.revision)throw Error('RECONCILE_REQUIRED');
  const result=await call(current.id,'/resolve',pending);
  if(result?.tripId!==current.id||result.state!=='CANCELLED'||!Number.isSafeInteger(result.revision)||result.revision<=current.revision)throw Error('UNCONFIRMED');
  current={...current,state:result.state,revision:result.revision};pending=null;caseIds.clear();incidentsList.replaceChildren();
  summary.textContent='Safety resolution confirmed: CANCELLED, revision '+current.revision+'. Payments remain independently controlled.';
 }));
 status.textContent='Operator authority not yet verified. No live dispatch or recovery permitted.';controls();
 return()=>{active=false;reset();root.remove();};
}
