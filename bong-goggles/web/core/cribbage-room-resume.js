// Only signed 420ID room participants receive an authorized match shortcut.
// No private hand, hidden engine state or stale seat projection is persisted.
import {CRIBBAGE_RULES_HASH} from './cribbage-session.js';
import {escapeHtml as esc} from './design-system.js';
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export async function findCribbageRoomMatch(client,room){
 if(room?.gameId!=='cribbage'||!['in_game','completed'].includes(room.status))
  return {status:200,session:null};
 const response=await client.request('/v1/classic-sessions');
 if(response.status!==200||response.data?.onChain!==false||
    response.data?.wager!==false||response.data?.rewards!==false||
    !Array.isArray(response.data.sessions)||response.data.sessions.length>50)
  return {status:response.status,session:null};
 const match=response.data.sessions.find(s=>s.roomId===room.id&&s.gameId==='cribbage'&&
  typeof s.id==='string'&&ID.test(s.id)&&s.rulesHash===CRIBBAGE_RULES_HASH&&
  s.seatCount===room.seatCount&&
  ['active','finished','resigned','timed_out','cancelled'].includes(s.status));
 return {status:200,session:match?Object.freeze({id:match.id,roomId:match.roomId}):null};
}
export function cribbageRoomEntry(room,session,live){
 if(room.gameId!=='cribbage'||!['in_game','completed'].includes(room.status))return '';
 const verified=session?.roomId===room.id?session:
  live?.status==='connected'&&live.session?.roomId===room.id?live.session:null;
 const href=verified?'/games/cribbage/play?session='+esc(verified.id):'/games/cribbage/history';
 return '<p><a class="ui-button" href="'+href+'" data-route="classic-game">'+
 (verified?'Resume active Cribbage game':'Find this game in My Games')+'</a></p>';
}
