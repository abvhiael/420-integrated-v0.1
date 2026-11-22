// BC-1.4: keep game-specific account-session orchestration out of the
// generic social application entry point and within its original asset budget.
import {CribbageSessionController} from './cribbage-session.js';
import {bindCribbageDom} from './cribbage-ui.js';
import {resolveRoute} from './routes.js';

export function createCribbageRouteRuntime({enabled=false,onChange=()=>{},windowObject=window,
 documentObject=document}={}){
 const controller=new CribbageSessionController({
  enabled,onChange:()=>{if(isCribbage())onChange();}
 });
 const isCribbage=()=>resolveRoute(windowObject.location.pathname).gameId==='cribbage';
 const matchId=()=>new URLSearchParams(windowObject.location.search).get('session');
 const refresh=()=>{
  const id=matchId();
  if(isCribbage()&&id&&controller.client.enabled)
   void controller.open(id,{quiet:true});
 };
 const bind=root=>{if(isCribbage())bindCribbageDom(root,controller);};
 // Headless, idle and hidden sessions need no unnecessary session traffic.
 const interval=windowObject.setInterval(()=>{
  if(!documentObject.hidden)refresh();
 },3500);
 return Object.freeze({
  get state(){return controller.state;},
  bind,refresh,
  invalidate:()=>controller.invalidate(),
  destroy:()=>{
   windowObject.clearInterval(interval);
   controller.destroy();
  }
 });
}
