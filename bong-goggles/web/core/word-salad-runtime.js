import {BOARD_SPECS,MODES} from './word-salad-rules.js';
import {classicRequestFailure} from './classic-rooms.js';
import {renderSaladTable,bindSaladTable} from './word-salad-ui.js';
import {SaladController,saladID,saladFormat,normalizeSalad,clean} from './word-salad-session.js';
import {escapeHtml as esc} from './design-system.js';
export function createSaladRuntime({enabled=false,onChange=()=>{},win=window,doc=document,fetchImpl=fetch}={}){
 const active=()=>/^\/games\/scrabble(?:\/|$)/.test(win.location.pathname);
 const id=()=>new URLSearchParams(win.location.search).get('session');
 const c=new SaladController({enabled,fetchImpl,onChange:()=>{if(active())onChange();}});
 let suspended=false;
 let writing=false;
 const refresh=()=>{if(active()&&!suspended&&enabled&&!writing)return c.refresh(id());};
 const go=path=>{win.history.pushState({},'',path);win.dispatchEvent(new Event('popstate'));};
 async function submit(form,startRoom=false){
  if(writing||!enabled||suspended)return;
  writing=true;const button=form.querySelector('button');button.disabled=true;
  let room=null;
  try{
   const actor=await c.principal();if(!actor)throw Error('Sign in with 420ID first');
   const origin=win.location.pathname+win.location.search;
   const confirm=async()=>{if(suspended||win.location.pathname+win.location.search!==origin||await c.principal()!==actor)throw Error('Account or route changed');};
   if(startRoom){
    const roomId=win.location.pathname.split('/').at(-1);
    if(!saladID(roomId))throw Error('Invalid room');
    const r=await c.client.request('/v1/classic-rooms/'+roomId);room=r.data?.room;
    if(r.status!==200||!clean(r)||room?.id!==roomId||room.gameId!=='scrabble'||room.host!==actor||room.status!=='ready')throw Error('Word Salad room is not ready');
   }else{
    const data=new FormData(form),count=Number(data.get('count')),format=[data.get('size'),data.get('mode'),data.get('timing')].join(':'),visibility=data.get('visibility');
    if(!saladFormat(format,count)||!['private','public'].includes(visibility))throw Error('Select a valid board and player count');
    const r=await c.client.request('/v1/classic-rooms',{method:'POST',body:{gameId:'scrabble',seatCount:count,visibility,format}});room=r.data?.room;
    if(r.status!==201||!clean(r)||!saladID(room?.id)||room.host!==actor||room.gameId!=='scrabble'||room.status!=='open'||room.seatCount!==count||room.variantId!==format)throw Error(classicRequestFailure(r,'Word Salad room creation'));
    await confirm();go('/games/rooms/'+room.id);return;
   }
   await confirm();
   const response=await c.client.request('/v1/classic-sessions',{method:'POST',body:{roomId:room.id}});
   const s=normalizeSalad(response,response.data?.session?.id);
   if(response.status!==201||!s||s.roomId!==room.id||s.viewerSeat!==0)throw Error(classicRequestFailure(response,'Word Salad start'));
   await confirm();go('/games/scrabble/play?session='+s.id);
  }catch(e){const p=doc.createElement('p');p.setAttribute('role','alert');p.textContent=e.message+(room?.id?' — check Multiplayer Rooms before retrying.':'');form.append(p);}
  finally{writing=false;button.disabled=false;void refresh();}
 }
 const invalidate=()=>c.invalidate();
 const online=()=>{if(active())void refresh();};
 const offline=()=>{if(active()){invalidate();c.emit({status:'unavailable',error:'Connection lost. Reconnect to recover your match.'});}};
 const visibility=()=>{if(doc.hidden){if(active())invalidate();}else online();};
 const timer=win.setInterval(()=>{if(!doc.hidden)void refresh();},3500);
 win.addEventListener('online',online);win.addEventListener('offline',offline);doc.addEventListener('visibilitychange',visibility);
 return {controller:c,get state(){return c.state;},refresh,invalidate,suspend(){suspended=true;invalidate();},resume(){suspended=false;return refresh();},identity(state){if(!active()||!enabled)return;if(state?.status==='guest'||state?.status==='error'||state?.status==='ready'&&c.actor&&state.profile?.subject!==c.actor)invalidate();},bind(root){if(active()&&enabled)bindSaladTable(root,c,win);const form=root.querySelector('[data-salad-create]');if(form){const sync=()=>{const max=BOARD_SPECS[form.elements.size.value]?.maxPlayers||2;for(const opt of form.elements.count.options)opt.disabled=Number(opt.value)>max;if(Number(form.elements.count.value)>max)form.elements.count.value=String(max);};form.elements.size.addEventListener('change',sync);sync();form.addEventListener('submit',e=>{e.preventDefault();void submit(e.currentTarget);});}root.querySelector('[data-salad-room-start]')?.addEventListener('submit',e=>{e.preventDefault();void submit(e.currentTarget,true);});root.querySelector('[data-salad-refresh]')?.addEventListener('click',()=>void refresh());},destroy(){suspended=true;win.clearInterval(timer);win.removeEventListener('online',online);win.removeEventListener('offline',offline);doc.removeEventListener('visibilitychange',visibility);invalidate();}};
}
// Restricted session discovery/recovery surface; gameplay rendering belongs to BC-4.4.2 onward.
export function renderSaladRecovery(state,screen){
 if(!state||state.status==='disabled')return '';
 const top='<section aria-label="Word Salad session recovery"><h2>Word Salad</h2><p>Free 420ID games · no wallet or wagers.</p>';
 const retry='<button type="button" data-salad-refresh>Refresh verified session</button>';
 const history='<a href="/games/scrabble/history" data-route="classic-game">My Games</a> · <a href="/games/scrabble" data-route="classic-game">Play / Create Game</a> · <a href="/games/rooms" data-route="classic-rooms">Join Game</a>';
 if(state.status==='guest')return top+'<p>Sign in with 420ID to recover your matches.</p><a href="/social-api/auth/start">Sign in with 420ID</a></section>';
 if(state.status==='unavailable')return top+'<p role="alert">'+esc(state.error||'Session unavailable')+'</p>'+retry+'</section>';
 if(state.session&&screen==='play')return renderSaladTable(state);
 if(state.session){const s=state.session;return top+'<p role="status">'+esc(s.status)+' · revision '+s.sequence+' · '+esc(s.privateView.variant)+'</p><p>'+esc(state.error||state.notice||'Server session verified.')+'</p>'+history+retry+'</section>';}
 const create='<form data-salad-create><h3>Create Game</h3><label>Board <select name="size">'+Object.values(BOARD_SPECS).map(p=>'<option value="'+p.size+'"'+(p.size===17?' selected':'')+'>'+p.size+' × '+p.size+' · '+esc(p.name)+'</option>').join('')+'</select></label><label>Players <select name="count"><option>2</option><option>3</option><option>4</option></select></label><label>Rules <select name="mode">'+MODES.map(m=>'<option>'+m+'</option>').join('')+'</select></label><label>Timing <select name="timing"><option>untimed</option><option>live</option><option>async</option></select></label><label>Visibility <select name="visibility"><option>private</option><option>public</option></select></label><p>Choose human or computer opponents in the room, then start.</p><button type="submit">Create Game</button></form>';
 return top+history+(state.status==='ready'?create+'<h3>My Games</h3><ul>'+state.matches.filter(m=>saladID(m.id)).map(m=>'<li><a href="/games/scrabble/play?session='+m.id+'" data-route="classic-game">'+esc(m.status==='active'?'Resume match':'Review completed match')+'</a></li>').join('')+'</ul>':'<p role="status">Checking 420ID session…</p>')+retry+'</section>';
}
