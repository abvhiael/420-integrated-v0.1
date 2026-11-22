// Account classic-room form wiring; controller owns validation and server state.
import {ROOM_LIMITS} from './classic-rooms.js';
export function bindClassicRoomsDom(root,classicRoomsController,{isSurface,onRefresh,onRouteChange,history}){
 if(!isSurface||!classicRoomsController?.client.enabled)return;
 root.querySelector('[data-classic-room-refresh]')?.addEventListener('click',()=>void onRefresh());
 const create=root.querySelector('[data-classic-room-create]');
 if(create){
  const syncSeats=()=>{
   const game=create.elements.namedItem('gameId')?.value,range=ROOM_LIMITS[game];
   const select=create.elements.namedItem('seatCount');
   if(!select||!range)return;
   for(const option of select.options)option.disabled=Number(option.value)<range[0]||Number(option.value)>range[1];
   if(select.selectedOptions[0]?.disabled)select.value=String(range[0]);
  };
  create.elements.namedItem('gameId')?.addEventListener('change',syncSeats);syncSeats();
  create.addEventListener('submit',async event=>{
   event.preventDefault();const data=new FormData(create);
   try{
    const next=await classicRoomsController.act('create',{
     gameId:data.get('gameId'),visibility:data.get('visibility'),
     seatCount:Number(data.get('seatCount'))
    });
    if(next.status==='ready'&&next.selected?.id){
     history.pushState({},'','/games/rooms/'+next.selected.id);
     onRouteChange();
    }
   }catch{ /* controller supplies a visible, bounded error notice */ }
  });
 }
 for(const form of root.querySelectorAll('[data-classic-room-action]'))form.addEventListener('submit',event=>{
  event.preventDefault();const data=new FormData(form);
  void classicRoomsController.act(form.dataset.classicRoomAction,{
   seat:Number(form.dataset.roomSeat),target:data.get('target')??null,
   difficulty:data.get('difficulty')??null
  }).catch(()=>{ /* already displayed by controller */ });
 });
}
