import {AppState, type AppStateStatus} from 'react-native';
import {safeResumeState} from './hardening-policy.mjs';

// No session, trip or availability authority is reconstructed by the OS foreground event.
export function subscribeToSessionSuspension(suspend:()=>void){
 let last:AppStateStatus=AppState.currentState;
 const subscription=AppState.addEventListener('change',next=>{
  if(next!=='active'||last!=='active')suspend();
  last=next;
 });
 return ()=>subscription.remove();
}
export function recoveredLaunchState(){return safeResumeState();}
