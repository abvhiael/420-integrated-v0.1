import {mountTripMessaging} from './trip-messaging.mjs';
import {createTripExperienceController} from './trip-experience-controller.mjs';
export function mountTripExperience(container,session,api,sessionProvider){
 let active=true;const ctl=createTripExperienceController({api,session});
 const panel=document.createElement('section');panel.className='panel';panel.setAttribute('aria-label','Confirmed rider trip');
 const heading=document.createElement('h2');heading.textContent='Trip status';
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const details=document.createElement('div');const actions=document.createElement('div');actions.className='actions';
 const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Refresh confirmed status';
 const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel trip';cancel.disabled=true;
 const incident=document.createElement('select');incident.setAttribute('aria-label','Incident category');
 for(const key of ['medical','collision','threat','vehicle','other']){const opt=document.createElement('option');opt.value=key;opt.textContent=key;incident.append(opt);}
 const report=document.createElement('button');report.type='button';report.textContent='Report incident';report.disabled=true;
 const contact=document.createElement('p');contact.textContent='Contact: available only through a verified, scoped messaging service. No unverified phone number or external contact link is exposed.';
 actions.append(refresh,cancel,incident,report);panel.append(heading,status,details,actions,contact);container.append(panel);
 const messaging=mountTripMessaging(container,session,()=>ctl.snapshot(),sessionProvider);
 let current=null,busy=false;
 function render(){
  const snapshot=ctl.snapshot();details.replaceChildren();
  if(!snapshot){status.textContent='No server-confirmed trip available.';cancel.disabled=true;report.disabled=true;return;}
  const add=(label,value)=>{const p=document.createElement('p');p.textContent=label+': '+value;details.append(p);};
  add('Confirmed state',snapshot.state);add('Confirmed revision',String(snapshot.revision));
  add('Driver ID',snapshot.driverId??'Not assigned');add('Vehicle ID',snapshot.vehicleId??'Not assigned');
  add('Arrival and progress',snapshot.state==='REQUESTED'?'Awaiting an assignment':snapshot.state==='ASSIGNED'?'Driver assigned, not yet arrived':snapshot.state==='ARRIVED'?'Driver arrival confirmed':snapshot.state==='IN_PROGRESS'?'Trip in progress (confirmed)':snapshot.state==='COMPLETED'?'Trip completed (confirmed)':'Trip cancelled (confirmed)');
  add('ETA','Not available — estimates are not confirmed events');
  cancel.disabled=busy||!['REQUESTED','ASSIGNED','ARRIVED'].includes(snapshot.state);
  report.disabled=busy||!['ASSIGNED','ARRIVED','IN_PROGRESS'].includes(snapshot.state);
  status.textContent='Updated from authorized trip service. No estimated event is labelled confirmed.';
 }
 async function load(id){
  if(!active||busy)return;busy=true;refresh.disabled=true;
  try{await ctl.load(id);if(active){current=id;render();}}
  catch{if(active){status.textContent='Trip state could not be verified. Retry to refresh; no status is assumed.';cancel.disabled=true;report.disabled=true;}}
  finally{busy=false;refresh.disabled=false;}
 }
 refresh.addEventListener('click',()=>{if(current)void load(current);});
 async function perform(type){
  if(busy||!current)return;busy=true;cancel.disabled=true;report.disabled=true;
  status.textContent=type==='cancel'?'Submitting a cancellation…':'Reporting incident to safety authority…';
  try{await(type==='cancel'?ctl.cancel():ctl.report(incident.value));if(active)render();}
  catch{if(active)status.textContent='Operation not confirmed. Retry uses the same command ID; refresh for authoritative state.';}
  finally{busy=false;if(active)render();}
 }
 cancel.addEventListener('click',()=>void perform('cancel'));
 report.addEventListener('click',()=>void perform('report'));
 render();
 return Object.freeze({load,destroy(){active=false;messaging.destroy();ctl.clear();panel.remove();}});
}
