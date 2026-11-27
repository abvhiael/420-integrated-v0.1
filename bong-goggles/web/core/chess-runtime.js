import {classicRequestFailure} from './classic-rooms.js';
import {ChessSocialController,bindChessSocial} from './chess-social.js';
import {ChessController,chessID,normalizeChessSession} from './chess-session.js';
import {bindChessScreen} from './chess-ui.js';
export function createChessRuntime({enabled=false,onChange=()=>{},win=window,doc=document,fetchImpl=fetch}={}){
 const active=()=>/^\/games\/chess(?:\/|$)/.test(win.location.pathname);
 const socialSurface=()=>active()||['/social','/account/games'].includes(win.location.pathname);
 const id=()=>new URLSearchParams(win.location.search).get('session');
 const routeKey=()=>win.location.pathname+'?session='+(id()||'');
 let currentRoute=routeKey();
 const c=new ChessController({enabled,fetchImpl,onChange:()=>{if(active())onChange();}});
 const social=new ChessSocialController({enabled,fetchImpl,onChange:()=>{if(socialSurface())onChange();}});
 // Keep identity checks responsive without repeatedly fetching private statistics.
 let socialAt=0,listAt=0,authAt=0,refreshing=false,epoch=0,pending=false,destroyed=false;
 const refresh=async(force=false)=>{
  if(destroyed||!enabled||!socialSurface())return;
  if(force===true){authAt=0;socialAt=0;listAt=0;pending=true;}
  if(refreshing||c.busy||social.busy)return;
  pending=false;
  const run=epoch;refreshing=true;
  try{
   const now=Date.now(),session=id();
   if(active()&&(session||c.state.status!=='ready'||now-listAt>=15000)){listAt=now;await c.refresh(session);}
   if(run!==epoch||c.busy||!socialSurface())return;
   if(now-authAt>=7000){
    authAt=now;
    const previous=social.state.viewer;
    const verified=await social.verifyIdentity();
    if(run!==epoch)return;
    if(!verified){socialAt=0;return;}
    if(previous!==social.state.viewer||social.state.status!=='ready')socialAt=0;
   }
   if(run===epoch&&!c.busy&&socialSurface()&&now-socialAt>=30000){socialAt=now;await social.refresh();}
  }finally{refreshing=false;if(pending&&!destroyed&&socialSurface()&&!c.busy&&!social.busy)void refresh();}
 };
 const roomGo=room=>{win.history.pushState({},'','/games/rooms/'+room);win.dispatchEvent(new Event('popstate'));};
 const go=s=>{win.history.pushState({},'','/games/chess/play?session='+s.id);win.dispatchEvent(new Event('popstate'));};
 async function start(form){
  if((c.busy&&!c.reading)||!c.client.enabled||c.state.status!=='ready')return;
  if(social.busy)social.invalidate();
  const data=new FormData(form),difficulty=data.get('difficulty'),clockProfile=data.get('clockProfile');
  if(!['easy','medium','hard'].includes(difficulty))return;
  c.reading=false;c.busy=true;const gen=++c.gen;let room=null;
  try{
   const actor=await c.principal();if(!actor||gen!==c.gen)throw Error('420ID session not confirmed');
   const created=await c.client.request('/v1/classic-rooms',{method:'POST',body:{gameId:'chess',visibility:'private',seatCount:2}});
   room=created.data?.room;
   if(created.status!==201||!chessID(room?.id)||room.host!==actor||room.gameId!=='chess'||room.status!=='open')throw Error(classicRequestFailure(created,'Chess room creation'));
   if(gen!==c.gen)return;await c.confirmPrincipal(actor);if(gen!==c.gen)return;
   const changed=await c.client.request('/v1/classic-rooms/'+room.id+'/change',{method:'POST',body:{action:'bot',seat:1,expectedRevision:room.revision,difficulty}});
   const ready=changed.data?.room;
   if(changed.status!==200||ready?.id!==room.id||ready.status!=='ready'||ready.seats?.[1]?.controller!=='bot'||ready.seats[1].difficulty!==difficulty)throw Error(classicRequestFailure(changed,'Chess opponent assignment'));
   if(gen!==c.gen)return;await c.confirmPrincipal(actor);if(gen!==c.gen)return;
   const response=await c.client.request('/v1/classic-sessions',{method:'POST',body:{roomId:room.id,clockProfile}});
   const s=normalizeChessSession({...response,status:200},response.data?.session?.id);
   if(response.status!==201||!s||s.roomId!==room.id||s.seat!==0||s.sequence!==1||gen!==c.gen||await c.principal()!==actor)throw Error(classicRequestFailure(response,'Chess match start'));
   go(s);
  }catch(e){if(gen===c.gen)c.emit({error:e.message+(room?.id?' — recover the room from Multiplayer Rooms.':'')});}
  finally{if(gen===c.gen)c.busy=false;}
 }
 const clocks=()=>{const s=c.state.session;if(!s)return;for(const el of doc.querySelectorAll('[data-chess-clock]')){
  const seat=Number(el.dataset.chessClock),clock=s.view.timing?.clock,remaining=clock?.remaining?.[seat];
  const ms=s.status==='active'&&s.view.turn===seat&&s.deadline?Math.max(0,Date.parse(s.deadline)-Date.now()):remaining;
  const seconds=Math.ceil(ms/1000);el.textContent=(seat?'Black':'White')+' · '+(Number.isFinite(seconds)?Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):'Untimed');
 }};
 const timer=win.setInterval(()=>{if(socialSurface()&&!doc.hidden)refresh();},3500);
 const ticker=win.setInterval(clocks,250);
 const online=()=>refresh(true);const visible=()=>{if(!doc.hidden)void refresh(true);};win.addEventListener('online',online);doc.addEventListener('visibilitychange',visible);
 return {get state(){return {...c.state,target:id(),social:social.state};},refresh,invalidate:()=>{const next=routeKey();if(next===currentRoute)return;currentRoute=next;epoch++;pending=true;c.invalidate();social.invalidate();socialAt=0;listAt=0;authAt=0;},bind(root){if(!c.client.enabled)return;
 const lobby=root.querySelector('[data-chess-room-start]');if(lobby)lobby.addEventListener('submit',async e=>{e.preventDefault();if(c.busy)return;c.busy=true;const gen=++c.gen;const roomId=win.location.pathname.split('/').at(-1);const clockProfile=new FormData(lobby).get('clockProfile');const submit=lobby.querySelector('button');submit.disabled=true;try{const actor=await c.principal();if(!actor||!chessID(roomId)||gen!==c.gen)throw Error('Room access unavailable');const r=await c.client.request('/v1/classic-sessions',{method:'POST',body:{roomId,clockProfile}});const s=normalizeChessSession({...r,status:200},r.data?.session?.id);if(r.status!==201||!s||s.roomId!==roomId||s.seat!==0||gen!==c.gen||await c.principal()!==actor)throw Error(classicRequestFailure(r,'Chess match start'));go(s);}catch(err){if(gen===c.gen){const p=doc.createElement('p');p.setAttribute('role','alert');p.textContent=err.message;lobby.append(p);}}finally{if(gen===c.gen)c.busy=false;submit.disabled=false;}});
 if(socialSurface())bindChessSocial(root,social,roomGo,active()?c.state.session:null);if(!active())return;bindChessScreen(root,c,win);root.querySelector('[data-chess-recover]')?.addEventListener('click',()=>void refresh(true));root.querySelector('[data-chess-start]')?.addEventListener('submit',e=>{e.preventDefault();void start(e.currentTarget);});clocks();},destroy(){destroyed=true;pending=false;epoch++;doc.removeEventListener('visibilitychange',visible);win.clearInterval(timer);win.clearInterval(ticker);win.removeEventListener('online',online);c.invalidate();social.invalidate();}};
}
