import {LABYRINTH_RULES_HASH} from './labyrinth-session.js';
import {LABYRINTH_RULES_VERSION} from './labyrinth-cribbage-ui.js';
import {escapeHtml as esc} from './design-system.js';
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const participant=(room,viewer)=>room?.gameId==='labyrinth-cribbage'&&['in_game','completed'].includes(room.status)&&room.seats?.some(s=>s.controller==='human'&&s.subject===viewer&&ID.test(viewer));
export async function findLabyrinthRoomMatch(client,room,viewer){
 if(!participant(room,viewer))return {status:200,session:null};
 const r=await client.request('/v1/classic-sessions');
 if(r.status!==200||r.data?.onChain!==false||r.data?.wager!==false||r.data?.rewards!==false||!Array.isArray(r.data.sessions)||r.data.sessions.length>50)return {status:r.status,session:null};
 const matches=r.data.sessions.filter(s=>s.roomId===room.id&&s.gameId===room.gameId&&ID.test(s.id)&&s.rulesHash===LABYRINTH_RULES_HASH&&s.rulesVersion===LABYRINTH_RULES_VERSION&&s.seatCount===room.seatCount&&Number.isSafeInteger(s.sequence)&&s.sequence>=1&&['active','finished','resigned','timed_out','cancelled'].includes(s.status));
 if(matches.length!==1)return {status:200,session:null};
 const me=await client.request('/v1/me');
 if(me.status!==200||me.data?.walletRequired!==false||me.data?.profile?.subject!==viewer)return {status:me.status,session:null};
 return {status:200,session:{id:matches[0].id,roomId:room.id}};
}
export function labyrinthRoomEntry(room,session,live,viewer){
 if(!participant(room,viewer))return '';
 const candidate=session?.roomId===room.id?session:live?.status==='connected'&&live.session?.roomId===room.id&&live.session?.gameId===room.gameId?live.session:null;
 const verified=candidate&&ID.test(candidate.id);
 return '<p><a class="ui-button" data-route="classic-game" href="'+(verified?'/games/labyrinth-cribbage/play?session='+esc(candidate.id):'/games/labyrinth-cribbage/history')+'">'+(verified?'Resume your private Labyrinth table':'Find this game in My Games')+'</a></p>';
}
