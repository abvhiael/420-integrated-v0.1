// BC-0.10 isolated, inert presentation for server-verified presence.
import {escapeHtml as esc} from './design-system.js';
const note=message=>'<p class="classic-room__notice" role="status">'+esc(message)+'</p>';
export function renderClassicRoomLive(r,live){
 const roomLive=live?.status==='connected'&&live.room?.id===r.id?
  '<section class="classic-room__live" aria-label="Live participant status"><h3>Live room status</h3>'+
  '<ul>'+r.seats.map(seat=>'<li>Seat '+(seat.index+1)+': '+
   esc(seat.controller==='human'?
    (live.presence?.seats.find(p=>p.seat===seat.index)?.online?'Online':'Offline or reconnecting'):
    seat.controller==='bot'?'Computer':seat.controller==='invited'?'Invited':'Unoccupied')+
   '</li>').join('')+'</ul>'+
  (live.session?'<p role="status">'+esc(live.session.status==='active'?
   (live.session.turnSeat===live.session.viewerSeat?'Your turn':'Waiting for another player'):
   'Session '+live.session.status)+' · sequence '+live.session.sequence+'</p>'+
   (live.session.deadline?'<p>Server turn deadline: <time datetime="'+esc(live.session.deadline)+'">'+
   esc(live.session.deadline)+'</time></p>':''):'')+
  (live.notice?note(live.notice):'')+
  '<p>Updates are reconciled from the server; no local turn or win is authoritative.</p></section>':
  (live?.status==='disabled'?note('Live room communications are not activated on this server.'):'');
 return roomLive;
}
