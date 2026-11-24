import {startLabyrinthComputerGame} from './labyrinth-computer-start.js';
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
 let starting=false,startError='',startGeneration=0;
 let lastSocial=0;
 let lastList=0;
 let pegMap=null,pegMapRequested=false;
 let pegMatch=null,pegScores=null,previousPegScores=null;
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
  if(!active())return;
  void loadPegMap();
  if(!controller.client.enabled||starting)return;
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
  const form=root.querySelector('[data-lab-computer-start]');
  if(form){
   const field=form.querySelector('fieldset'),status=form.querySelector('[data-lab-computer-status]');
   const sync=()=>{form.elements.format.disabled=form.elements.players.value!=='4';};
   form.elements.players.addEventListener('change',sync);sync();
   if(starting){field.disabled=true;status.textContent='Creating your private game…';}
   else if(startError)status.textContent=startError;
   form.addEventListener('submit',async e=>{
    e.preventDefault();if(starting||!controller.client.enabled||field.disabled)return;
    starting=true;startError='';field.disabled=true;status.textContent='Creating your private game…';
    const gen=++startGeneration;
    const config={players:Number(form.elements.players.value),difficulty:form.elements.difficulty.value,format:form.elements.format.value};
    try{
     const id=await startLabyrinthComputerGame(controller.client,config,()=>active()&&gen===startGeneration);
     if(gen!==startGeneration)return;
     windowObject.location.assign('/games/labyrinth-cribbage/play?session='+encodeURIComponent(id));
    }catch(e){if(gen===startGeneration){startError=e.message;starting=false;onChange();}}
   });
  }
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
  if(!view){pegMatch=null;pegScores=null;previousPegScores=null;}
  if(view&&pegMap){
   const key=view.sessionId+':'+view.viewerSeat;
   if(pegMatch!==key){pegMatch=key;pegScores=[...view.scores];previousPegScores=view.scores.map(s=>s===0?0:null);}
   else if(pegScores){for(let i=0;i<view.scores.length;i++){
    if(view.scores[i]>pegScores[i])previousPegScores[i]=pegScores[i];
    else if(view.scores[i]<pegScores[i])previousPegScores[i]=null;
   }pegScores=[...view.scores];}
   const teams=labyrinthCribbageVariant(view.seatCount,
    view.variant==='labyrinth-4p-individual'?'individual':'partnerships').teams;
   const overlay=renderLabyrinthPegOverlay({scores:view.scores,teams,previousScores:previousPegScores},pegMap);
   if(overlay)for(const art of root.querySelectorAll('.lab-board-art')){
    art.querySelector('.lab-peg-overlay')?.remove();
    art.insertAdjacentHTML('beforeend',overlay);
    const caption=art.closest('.lab-board')?.querySelector('figcaption');
    if(caption)caption.textContent='Owner-traced peg routes · first to 325 points wins.';
   }
  }
  if(!view&&pegMap){for(const art of root.querySelectorAll('.lab-board-art')){
   const overlay=renderLabyrinthPegOverlay({scores:[0,0],teams:[0,1],previousScores:[0,0]},pegMap);
   if(overlay&&!art.querySelector('.lab-peg-overlay'))art.insertAdjacentHTML('beforeend',overlay);
  }}
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
  get state(){return {...controller.state,social:social.state,computerEnabled:controller.client.enabled};},
  bind,refresh,
  invalidate:()=>{startGeneration++;starting=false;startError='';pegMatch=null;pegScores=null;previousPegScores=null;controller.invalidate();social.invalidate();lastSocial=0;},
  destroy:()=>{startGeneration++;starting=false;
   windowObject.clearInterval(interval);
   windowObject.removeEventListener('online',online);
   documentObject.removeEventListener('visibilitychange',visible);
   controller.invalidate();social.invalidate();
  }
 });
}
