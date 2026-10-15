import {createDriverAvailabilityController} from './driver-availability-controller.mjs';
export function mountDriverAvailability(container,session,api){
 const root=document.createElement('section');root.className='panel';root.setAttribute('aria-label','Driver availability and offers');
 const heading=document.createElement('h2');heading.textContent='Availability & offers';
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const controls=document.createElement('div'),offers=document.createElement('div');
 const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Refresh verified status';
 const online=document.createElement('button');online.type='button';online.textContent='Go online';online.disabled=true;
 const offline=document.createElement('button');offline.type='button';offline.textContent='Go offline';offline.disabled=true;
 const capLabel=document.createElement('label');capLabel.textContent='Vehicle passenger capacity ';
 const cap=document.createElement('input');cap.type='number';cap.min='1';cap.max='12';cap.step='1';cap.value='1';capLabel.append(cap);
 controls.append(capLabel,refresh,online,offline);root.append(heading,status,controls,offers);container.append(root);
 let active=true,controller=null,ticker=null;
 if(!api||session?.status!=='authenticated'||!session.roles?.includes('driver')||!session.subject){
  status.textContent='Independently authenticated driver services are unavailable. No live offers or availability can be shown.';
  return()=>{active=false;root.remove();};
 }
 controller=createDriverAvailabilityController({api,session});
 const render=()=>{
  if(!active)return;
  const v=controller.snapshot();offers.replaceChildren();
  online.disabled=v.busy||v.disconnected||!v.current||v.current.active;
  offline.disabled=v.busy||v.disconnected||!v.current||!v.current.active;
  if(!v.current){status.textContent='Authoritative availability unavailable. Remain offline until the server is reachable.';return;}
  const now=Math.floor(Date.now()/1000);
  const valid=v.current.online&&v.current.expiresAt>now;
  status.textContent=valid?'Availability confirmed online until '+new Date(v.current.expiresAt*1000).toLocaleTimeString():'Offline or stale. Refresh authoritative status before accepting offers.';
  for(const item of v.offers){
   const p=document.createElement('section');p.className='panel';
   const info=document.createElement('p');
   const seconds=Math.max(0,item.expiresAt-now);
   info.textContent='Offer '+item.offerId+' — '+item.status+' — '+(seconds>0?seconds+' seconds remaining':'expired')+'. Capacity and admission remain server-authoritative.';
   const accept=document.createElement('button');accept.type='button';accept.textContent='Accept offer';
   const reject=document.createElement('button');reject.type='button';reject.textContent='Reject offer';
   const permitted=item.status==='PENDING'&&seconds>0&&valid&&!v.busy&&!v.disconnected;
   accept.disabled=!permitted;reject.disabled=!permitted;
   const respond=async decision=>{accept.disabled=true;reject.disabled=true;
    try{await controller.respond(item,decision);render();}
    catch{status.textContent='Offer response unconfirmed. Refresh after connection recovery; do not assume acceptance.';}
   };
   accept.addEventListener('click',()=>void respond('accept'));reject.addEventListener('click',()=>void respond('reject'));
   p.append(info,accept,reject);offers.append(p);
  }
 };
 const load=async()=>{refresh.disabled=true;try{await controller.refresh();render();}
  catch{if(active){controller.disconnect();render();}}
  finally{refresh.disabled=false;}
 };
 const change=async value=>{const v=controller.snapshot().current;if(!v)return;
  try{await controller.setOnline(value,v.vehicleId,Number(cap.value));render();}
  catch{status.textContent='Availability change unconfirmed. Refresh status; do not assume online or offline.';}
 };
 refresh.addEventListener('click',()=>{controller.reconnect();void load();});
 online.addEventListener('click',()=>void change(true));offline.addEventListener('click',()=>void change(false));
 const lost=()=>{controller.disconnect();render();};
 globalThis.addEventListener?.('offline',lost);
 const restored=()=>{controller.reconnect();void load();};
 globalThis.addEventListener?.('online',restored);
 ticker=globalThis.setInterval?.(()=>render(),1000);
 void load();
 return()=>{active=false;controller.disconnect();if(ticker!==null)globalThis.clearInterval?.(ticker);
  globalThis.removeEventListener?.('offline',lost);globalThis.removeEventListener?.('online',restored);root.remove();};
}
