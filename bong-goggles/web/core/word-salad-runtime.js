import {renderSaladTable,bindSaladTable} from './word-salad-ui.js';
import {SaladController,saladID} from './word-salad-session.js';
import {escapeHtml as esc} from './design-system.js';
export function createSaladRuntime({enabled=false,onChange=()=>{},win=window,doc=document,fetchImpl=fetch}={}){
 const active=()=>/^\/games\/scrabble(?:\/|$)/.test(win.location.pathname);
 const id=()=>new URLSearchParams(win.location.search).get('session');
 const c=new SaladController({enabled,fetchImpl,onChange:()=>{if(active())onChange();}});
 let suspended=false;
 const refresh=()=>{if(active()&&!suspended&&enabled)return c.refresh(id());};
 const invalidate=()=>c.invalidate();
 const online=()=>{if(active())void refresh();};
 const offline=()=>{if(active()){invalidate();c.emit({status:'unavailable',error:'Connection lost. Reconnect to recover your match.'});}};
 const visibility=()=>{if(doc.hidden){if(active())invalidate();}else online();};
 const timer=win.setInterval(()=>{if(!doc.hidden)void refresh();},3500);
 win.addEventListener('online',online);win.addEventListener('offline',offline);doc.addEventListener('visibilitychange',visibility);
 return {controller:c,get state(){return c.state;},refresh,invalidate,suspend(){suspended=true;invalidate();},resume(){suspended=false;return refresh();},identity(state){if(!active()||!enabled)return;if(state?.status==='guest'||state?.status==='error'||state?.status==='ready'&&c.actor&&state.profile?.subject!==c.actor)invalidate();},bind(root){if(active()&&enabled)bindSaladTable(root,c,win);root.querySelector('[data-salad-refresh]')?.addEventListener('click',()=>void refresh());},destroy(){suspended=true;win.clearInterval(timer);win.removeEventListener('online',online);win.removeEventListener('offline',offline);doc.removeEventListener('visibilitychange',visibility);invalidate();}};
}
// Restricted session discovery/recovery surface; gameplay rendering belongs to BC-4.4.2 onward.
export function renderSaladRecovery(state,screen){
 if(!state||state.status==='disabled')return '';
 const top='<section aria-label="Word Salad session recovery"><h2>Word Salad · Restricted acceptance</h2><p>Public Play remains gated.</p>';
 const retry='<button type="button" data-salad-refresh>Refresh verified session</button>';
 const history='<a href="/games/scrabble/history" data-route="classic-game">My Word Salad matches</a>';
 if(state.status==='guest')return top+'<p>Sign in with 420ID to recover your matches.</p><a href="/social-api/auth/start">Sign in with 420ID</a></section>';
 if(state.status==='unavailable')return top+'<p role="alert">'+esc(state.error||'Session unavailable')+'</p>'+retry+'</section>';
 if(state.session&&screen==='play')return renderSaladTable(state);
 if(state.session){const s=state.session;return top+'<p role="status">'+esc(s.status)+' · revision '+s.sequence+' · '+esc(s.privateView.variant)+'</p><p>'+esc(state.error||state.notice||'Server session verified.')+'</p>'+history+retry+'</section>';}
 return top+(state.status==='ready'?'<ul>'+state.matches.filter(m=>saladID(m.id)).map(m=>'<li><a href="/games/scrabble/play?session='+m.id+'" data-route="classic-game">'+esc(m.status==='active'?'Resume match':'Review completed match')+'</a></li>').join('')+'</ul>':'<p role="status">Checking 420ID session…</p>')+retry+'</section>';
}
