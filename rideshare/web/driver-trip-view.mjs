import {createDriverTripController} from './driver-trip-controller.mjs';
// Driver-only controls; never render a state change until an authenticated reread.
export function mountDriverTrip(container,session,api,{navigationCapability,openNavigation=()=>{}}={}){
 let active=true,tripId=null;
 const ctl=createDriverTripController({api,session,navigationCapability});
 const panel=document.createElement('section');panel.className='panel';panel.setAttribute('aria-label','Verified driver trip controls');
 const title=document.createElement('h2');title.textContent='Driver trip controls';
 const input=document.createElement('input');input.setAttribute('aria-label','Assigned trip ID');input.placeholder='Assigned trip ID';
 const load=document.createElement('button');load.type='button';load.textContent='Verify trip';
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const details=document.createElement('p');
 const pickup=document.createElement('input');pickup.type='checkbox';pickup.setAttribute('aria-label','I have confirmed the rider pickup in person');
 const pickupLabel=document.createElement('label');pickupLabel.append(pickup,document.createTextNode(' Confirm pickup in person before starting'));
 const arrive=document.createElement('button');arrive.type='button';arrive.textContent='Confirm arrival';
 const start=document.createElement('button');start.type='button';start.textContent='Start confirmed pickup';
 const complete=document.createElement('button');complete.type='button';complete.textContent='Complete trip';
 const nav=document.createElement('button');nav.type='button';nav.textContent='Navigation handoff';
 const incident=document.createElement('select');incident.setAttribute('aria-label','Driver safety incident type');
 for(const c of ['medical','collision','threat','vehicle','other']){const o=document.createElement('option');o.value=c;o.textContent=c;incident.append(o);}
 const report=document.createElement('button');report.type='button';report.textContent='Report safety incident';
 const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Reconcile confirmed trip';
 const offline=document.createElement('p');offline.textContent='Offline actions are disabled and never queued. Reconnect and verify authoritative state before retrying.';
 panel.append(title,input,load,status,details,pickupLabel,arrive,start,complete,nav,incident,report,refresh,offline);container.append(panel);
 let busy=false,connected=true;
 const buttons=[load,arrive,start,complete,nav,report,refresh];
 function render(message){
  const s=ctl.snapshot(),p=s.presentation;details.textContent=s.trip?'Server-confirmed: '+p.state+' / revision '+p.revision:'No verified trip. No action is authorized.';
  status.textContent=message??(connected?'Only server-confirmed transitions are displayed.':'Disconnected — no actions can be submitted.');
  load.disabled=busy||!connected;refresh.disabled=busy||!connected||!tripId;
  arrive.disabled=busy||!connected||!p.canArrive;start.disabled=busy||!connected||!p.canStart||!s.pickupConfirmed;
  complete.disabled=busy||!connected||!p.canComplete;report.disabled=busy||!connected||!p.canReport;
  nav.disabled=busy||!connected||!s.trip||!navigationCapability||p.terminal;
  pickup.disabled=busy||!connected||!p.canStart;pickup.checked=s.pickupConfirmed;
 }
 async function execute(fn){
  if(!active||busy||!connected)return;busy=true;render('Checking authoritative service…');
  try{await fn();if(active)render('State confirmed by authenticated service.');}
  catch{if(active)render('Operation not confirmed. Reconcile server state before retrying; no event is assumed.');}
  finally{busy=false;if(active)render();}
 }
 load.addEventListener('click',()=>{tripId=input.value.trim();void execute(()=>ctl.load(tripId));});
 refresh.addEventListener('click',()=>void execute(()=>ctl.reconcile()));
 pickup.addEventListener('change',()=>{try{ctl.confirmPickup(pickup.checked)}catch{pickup.checked=false}render();});
 arrive.addEventListener('click',()=>void execute(()=>ctl.action('arrive')));
 start.addEventListener('click',()=>void execute(()=>ctl.action('start')));
 complete.addEventListener('click',()=>void execute(()=>ctl.action('complete')));
 report.addEventListener('click',()=>void execute(()=>ctl.report(incident.value)));
 nav.addEventListener('click',()=>void execute(async()=>{const target=await ctl.navigation();openNavigation(target);}));
 const down=()=>{connected=false;ctl.disconnect();if(active)render();};
 const up=()=>{connected=true;ctl.reconnect();if(active)render('Reconnected. Verify the trip before any new action.');};
 window.addEventListener('offline',down);window.addEventListener('online',up);
 render();
 return Object.freeze({load:id=>{tripId=id;return execute(()=>ctl.load(id));},destroy(){active=false;ctl.clear();window.removeEventListener('offline',down);window.removeEventListener('online',up);panel.remove();}});
}
