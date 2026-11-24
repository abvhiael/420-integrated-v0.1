import {resolveRoute} from './routes.js';
import {LabyrinthSessionController} from './labyrinth-session.js';
import {LabyrinthSocialController,bindLabyrinthSocial} from './labyrinth-social.js';
import {bindLabyrinthTable,verifyLabyrinthProjection} from './labyrinth-cribbage-ui.js';
import {labyrinthCribbageVariant} from './labyrinth-cribbage-rules.js';
import {validateLabyrinthPegAtlas,renderLabyrinthPegOverlay} from './labyrinth-peg-overlay.js';

// Only currently visited Labyrinth routes poll the authenticated session;
// the controller retains the same table state through every accepted move.
export function createLabyrinthRouteRuntime({enabled=false,onChange=()=>{},
 windowObject=window,documentObject=document,fetchImpl=fetch}={}){
 const active=()=>resolveRoute(windowObject.location.pathname).gameId==='labyrinth-cribbage';
 const controller=new LabyrinthSessionController({enabled,fetchImpl,
  onChange:()=>{if(active())onChange();}});
 const social=new LabyrinthSocialController({enabled,fetchImpl,onChange:()=>{if(active())onChange();}});
 const matchId=()=>new URLSearchParams(windowObject.location.search).get('session');
 const socialScreen=()=>/\/(history|rematch|results)$/.test(windowObject.location.pathname);
 let lastSocial=0;
 let lastList=0;
 let pegMap=null,pegMapRequested=false;
 const loadPegMap=async()=>{
  if(pegMapRequested)return;
  pegMapRequested=true;
  try{
   const response=await fetchImpl('/core/labyrinth-peg-map.json',{cache:'no-store'});
   if(!response.ok)return;
   const candidate=await response.json();
   if(!validateLabyrinthPegAtlas(candidate))return;
   pegMap=candidate;
   if(active())onChange();
  }catch{/* Missing or invalid map cannot authorize physical pegs. */}
 };
 const refresh=(force=false)=>{
  if(!active()||!controller.client.enabled)return;
  void loadPegMap();
  if(socialScreen()&&(force||Date.now()-lastSocial>=15000)){
   lastSocial=Date.now();void social.refresh();
  }
  const id=matchId();
  if(id)void controller.open(id,{quiet:true});
  else if(force||Date.now()-lastList>=15000){
   lastList=Date.now();void controller.list();
  }
 };
 const online=()=>refresh(true);
 const visible=()=>{if(!documentObject.hidden)refresh(true);};
 windowObject.addEventListener('online',online);
 documentObject.addEventListener('visibilitychange',visible);
 const bind=root=>{
  if(!active())return;
  bindLabyrinthSocial(root,social,id=>windowObject.location.assign('/games/rooms/'+id));
  bindLabyrinthTable(root,{view:controller.state.view,selection:controller.state.selection,
   onSelection:x=>controller.select(x),
   onMove:m=>{void controller.act(m).catch(()=>{});}
  });
  for(const button of root.querySelectorAll('[data-lab-lifecycle]')){
   button.addEventListener('click',()=>{
    const action=button.dataset.labLifecycle;
    if(action!=='resign'||controller.state.submitting)return;
    button.disabled=true;
    void controller.lifecycle(action).catch(()=>{button.disabled=false;});
   });
  }
  for(const button of root.querySelectorAll('[data-lab-rematch]')){
   button.addEventListener('click',()=>{
    if(controller.state.submitting)return;
    button.disabled=true;
    void controller.rematch().then(roomId=>{
     if(!roomId)return;
     windowObject.history.pushState({},'','/games/rooms/'+encodeURIComponent(roomId));
     controller.invalidate();
     onChange();
     windowObject.dispatchEvent(new Event('popstate'));
    }).catch(()=>{button.disabled=false;});
   });
  }
  const view=verifyLabyrinthProjection(controller.state.view);
  if(view&&pegMap){
   const teams=labyrinthCribbageVariant(view.seatCount,
    view.variant==='labyrinth-4p-individual'?'individual':'partnerships').teams;
   const overlay=renderLabyrinthPegOverlay({scores:view.scores,teams},pegMap);
   if(overlay)for(const art of root.querySelectorAll('.lab-board-art')){
    if(!art.querySelector('.lab-peg-overlay'))art.insertAdjacentHTML('beforeend',overlay);
    const caption=art.closest('.lab-board')?.querySelector('figcaption');
    if(caption)caption.textContent='Verified physical peg positions · first to 325 points wins.';
   }
  }
  for(const img of root.querySelectorAll('.lab-board-art img')){
   img.addEventListener('error',()=>{
    img.hidden=true;
    const notice=img.parentElement?.querySelector('[data-lab-art-missing]');
    if(notice)notice.hidden=false;
   });
  }
 };
 const interval=windowObject.setInterval(()=>{if(!documentObject.hidden)refresh();},3500);
 return Object.freeze({
  get state(){return {...controller.state,social:social.state};},
  bind,refresh,
  invalidate:()=>{controller.invalidate();social.invalidate();lastSocial=0;},
  destroy:()=>{
   windowObject.clearInterval(interval);
   windowObject.removeEventListener('online',online);
   documentObject.removeEventListener('visibilitychange',visible);
   controller.invalidate();social.invalidate();
  }
 });
}
