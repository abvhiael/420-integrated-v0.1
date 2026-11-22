import {ClassicCommunicationsController} from './classic-communications.js';
export function cc({rooms,enabled,route,onChange,windowObject,documentObject}){
 const live=new ClassicCommunicationsController({enabled,onChange,onRoom:room=>{
  const s=rooms.state;
  if(room&&s?.status==='ready'&&s.selected?.id===room.id&&room.revision>s.selected.revision)
   rooms.emit({...s,selected:room,notice:'Room updated from the server.'});
 }});
 const active=()=>['classic-room','classic-rooms'].includes(route().id);
 const poll=()=>{const s=rooms.state;if(live.enabled&&active()&&s?.status==='ready'&&s.selected)
  return live.sync({room:s.selected,viewer:s.viewer});};
 const refresh=async id=>{const s=await rooms.refresh(id);if(active()&&s?.status==='ready'&&s.selected)await poll();return s;};
 const onOnline=()=>{if(active())void refresh(route().roomId??null);};
 const onVisible=()=>{if(!documentObject.hidden)onOnline();};
 const timer=windowObject.setInterval(()=>{if(!documentObject.hidden)void poll();},5000);
 windowObject.addEventListener('online',onOnline);
 documentObject.addEventListener('visibilitychange',onVisible);
 return {get state(){return live.enabled?live.state:null;},refresh,
  invalidate:()=>live.invalidate(),destroy:()=>{
   live.invalidate();windowObject.clearInterval(timer);
   windowObject.removeEventListener('online',onOnline);
   documentObject.removeEventListener('visibilitychange',onVisible);
  }};
}
