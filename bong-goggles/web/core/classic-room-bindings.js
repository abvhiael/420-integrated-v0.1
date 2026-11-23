import {bindCribbageRoomStart as b} from './classic-cribbage-multiplayer.js';
import {bindLabyrinthRoomStart} from './labyrinth-room-start.js';
// Account classic-room form wiring; controller owns validation and server state.
import {ROOM_LIMITS} from './classic-rooms.js';
export function bindClassicRoomsDom(root,classicRoomsController,{isSurface,onRefresh,onRouteChange,history}){
 if(!isSurface||!classicRoomsController?.client.enabled)return;
 root.querySelector('[data-classic-room-refresh]')?.addEventListener('click',()=>void onRefresh());
 b(root,classicRoomsController,{history,onRouteChange,onRefresh});
 bindLabyrinthRoomStart(root,classicRoomsController,{history,onRouteChange,onRefresh});
 const create=root.querySelector('[data-classic-room-create]');
 if(create){
  const syncSeats=()=>{
   const game=create.elements.namedItem('gameId')?.value,range=ROOM_LIMITS[game];
   const select=create.elements.namedItem('seatCount');
   if(!select||!range)return;
   for(const option of select.options)option.disabled=Number(option.value)<range[0]||Number(option.value)>range[1];
   if(select.selectedOptions[0]?.disabled)select.value=String(range[0]);
   const options=create.querySelector('[data-labyrinth-room-format]');
   if(options){options.hidden=!(game==='labyrinth-cribbage'&&Number(select.value)===4);}
   if(game!=='labyrinth-cribbage')create.elements.namedItem('format').value='partnerships';
  };
  create.elements.namedItem('gameId')?.addEventListener('change',syncSeats);
  create.elements.namedItem('seatCount')?.addEventListener('change',syncSeats);syncSeats();
  create.addEventListener('submit',async event=>{
   event.preventDefault();const data=new FormData(create);
   try{
    const next=await classicRoomsController.act('create',{
     gameId:data.get('gameId'),visibility:data.get('visibility'),
     seatCount:Number(data.get('seatCount')),
     format:data.get('gameId')==='labyrinth-cribbage'&&Number(data.get('seatCount'))===4?data.get('format'):''
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
