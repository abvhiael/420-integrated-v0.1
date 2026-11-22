import {discoverCribbageMatches} from './classic-cribbage-multiplayer.js';
import {CribbageSocialController,bindCribbageSocial} from './classic-cribbage-social.js';
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
 const social=new CribbageSocialController({enabled,onChange:()=>{if(isCribbage())onChange();}});
 const socialScreen=()=>/\/(history|rematch|results)$/.test(windowObject.location.pathname);
 let lastSocial=0;
 const matchId=()=>new URLSearchParams(windowObject.location.search).get('session');
 let lastDiscovery=0;
 const refresh=(force=false)=>{
  if(!isCribbage()||!controller.client.enabled)return;
  if(socialScreen()&&(force||Date.now()-lastSocial>=15000)){
   lastSocial=Date.now();void social.refresh();
  }
  const id=matchId();
  if(id)void controller.open(id,{quiet:true});
  else if(force||Date.now()-lastDiscovery>=15000){
   lastDiscovery=Date.now();
   void discoverCribbageMatches(controller);
  }
 };
 const onOnline=()=>refresh(true);
 const onVisible=()=>{if(!documentObject.hidden)refresh(true);};
 windowObject.addEventListener('online',onOnline);
 documentObject.addEventListener('visibilitychange',onVisible);
 const bind=root=>{if(isCribbage()){
  bindCribbageDom(root,controller);
  bindCribbageSocial(root,social,id=>windowObject.location.assign('/games/rooms/'+id));
 }};
 // Headless, idle and hidden sessions need no unnecessary session traffic.
 const interval=windowObject.setInterval(()=>{
  if(!documentObject.hidden)refresh();
 },3500);
 return Object.freeze({
  get state(){return {...controller.state,social:social.state};},
  bind,refresh,
  invalidate:()=>{controller.invalidate();social.invalidate();lastSocial=0;},
  destroy:()=>{
   windowObject.clearInterval(interval);
   windowObject.removeEventListener('online',onOnline);
   documentObject.removeEventListener('visibilitychange',onVisible);
   controller.destroy();social.invalidate();
  }
 });
}
