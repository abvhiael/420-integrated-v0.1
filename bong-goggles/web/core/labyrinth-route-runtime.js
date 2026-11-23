import {resolveRoute} from './routes.js';
import {LabyrinthSessionController} from './labyrinth-session.js';
import {bindLabyrinthTable} from './labyrinth-cribbage-ui.js';

// Only currently visited Labyrinth routes poll the authenticated session;
// the controller retains the same table state through every accepted move.
export function createLabyrinthRouteRuntime({enabled=false,onChange=()=>{},
 windowObject=window,documentObject=document,fetchImpl=fetch}={}){
 const active=()=>resolveRoute(windowObject.location.pathname).gameId==='labyrinth-cribbage';
 const controller=new LabyrinthSessionController({enabled,fetchImpl,
  onChange:()=>{if(active())onChange();}});
 const matchId=()=>new URLSearchParams(windowObject.location.search).get('session');
 let lastList=0;
 const refresh=(force=false)=>{
  if(!active()||!controller.client.enabled)return;
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
  bindLabyrinthTable(root,{view:controller.state.view,selection:controller.state.selection,
   onSelection:x=>controller.select(x),
   onMove:m=>{void controller.act(m).catch(()=>{});}
  });
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
  get state(){return controller.state;},
  bind,refresh,
  invalidate:()=>controller.invalidate(),
  destroy:()=>{
   windowObject.clearInterval(interval);
   windowObject.removeEventListener('online',online);
   documentObject.removeEventListener('visibilitychange',visible);
   controller.invalidate();
  }
 });
}
