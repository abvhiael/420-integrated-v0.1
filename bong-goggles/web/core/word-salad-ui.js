import {escapeHtml as esc} from './design-system.js';
import {BOARD_SPECS} from './word-salad-rules.js';
import {TILE_VALUES} from './word-salad-tiles.js';
export const SALAD_ASSETS='/assets/games/word-salad/';
const avatars=['alien','bearded','sativa','sloth'];
const premiums={sprout:['DL','Sprout · double letter','dl'],flower:['TL','Flower · triple letter','tl'],concentrate:['4L','Concentrate · quadruple letter','4l'],hotbox:['DW','Hotbox · double word','dw'],harvest:['TW','Harvest · triple word','tw'],mother:['★','Mother Plant · double word','mother-plant']};
const img=(path,cls='',alt='')=>'<img class="'+cls+'" src="'+SALAD_ASSETS+path+'" alt="'+esc(alt)+'" draggable="false">';
export const SALAD_ART=Object.freeze(['logo/word-salad-logo.png','wallpaper/word-salad-wallpaper.png','boards/board-frame.png','boards/board-center-leaf.png',...Object.keys(BOARD_SPECS).map(n=>'boards/word-salad-board-'+n+'x'+n+'.png'),...['normal','dl','tl','4l','dw','tw','mother-plant'].map(x=>'boards/square-'+x+'.png'),...Object.keys(TILE_VALUES).map(x=>'tiles/tile-'+(x==='?'?'blank':x.toLowerCase())+'.png'),'tiles/tile-back.png',...avatars.map(x=>'avatars/avatar-'+x+'.png'),'ui/word-salad-tile-rack.png','ui/rack-endcap.png','ui/tile-highlight.png',...['play-word','shuffle','exchange','pass'].map(x=>'ui/word-salad-ui-'+x+'-button.png')]);
function tile(symbol,blank=false){if(blank)return '<span class="ws-blank">'+img('tiles/tile-blank.png')+'<b>'+esc(symbol==='?'?'':symbol)+'</b><small>0</small></span>';return img('tiles/tile-'+symbol.toLowerCase()+'.png','ws-tile');}
function control(action,label,disabled,art=false){return '<button type="button" class="ws-action'+(art?' ws-art-action':'')+'" data-ws-action="'+action+'"'+(disabled?' disabled':'')+'>'+ (art?img('ui/word-salad-ui-'+action+'-button.png','ws-action-art'):'')+'<span>'+label+'</span></button>';}
export function renderSaladTable(state){
 const s=state.session;if(!s||!['ready','submitting','idle','reconnecting'].includes(state.status))return '';
 const v=s.privateView,p=BOARD_SPECS[s.format.p.size],n=p.size;
 const playable=state.status==='ready'&&!v.terminal&&s.viewerSeat===v.turn&&!v.forfeit[s.viewerSeat];
 const selected=state.selected,draft=state.draft||{},used=new Set(Object.values(draft).map(t=>t.id)),rackById=new Map(v.rack.map(t=>[t.id,t]));
 const order=[...new Set([...(state.order||[]),...v.rack.map(t=>t.id)])].filter(id=>rackById.has(id));
 const cells=p.board.flatMap((row,y)=>row.map((premium,x)=>{
 const q=y*n+x,committed=Object.hasOwn(v.board,q),pending=draft[q],t=pending&&rackById.get(pending.id),symbol=committed?v.board[q]:t?(pending.blank||t.symbol):null,blank=committed?v.blankCells.includes(q):t?.symbol==='?',info=premiums[premium],label='Row '+(y+1)+', column '+(x+1)+(symbol?' · '+symbol+(blank?' · blank, zero points':''):(info?' · '+info[1]:' · empty'));
 return '<button type="button" class="ws-cell'+(committed?' ws-committed':t?' ws-draft':'')+'" data-ws-cell="'+q+'" aria-label="'+esc(label)+'"'+(!playable||committed?' disabled':'')+'>'+img('boards/square-'+(info?info[2]:'normal')+'.png','ws-square')+(symbol?tile(symbol,blank):info?'<span class="ws-premium">'+(premium==='mother'?img('boards/board-center-leaf.png') :info[0])+'</span>':'')+'</button>';
 })).join('');
 const players=v.scores.map((score,i)=>{const seat=state.seats?.[i],name=i===s.viewerSeat?'You':seat?.controller==='bot'?'Computer '+(i+1):'Player '+(i+1);return '<article class="ws-player'+(!v.terminal&&v.turn===i?' ws-active':'')+'">'+img('avatars/avatar-'+avatars[i]+'.png','ws-avatar')+'<div><strong>'+name+'</strong><small>'+esc(v.forfeit[i]?'Resigned':seat?.controller==='bot'?seat.difficulty+' bot':i===s.viewerSeat?'Your seat':'420ID member')+'</small><small>'+v.rackCounts[i]+' tiles'+(!v.terminal&&v.turn===i?' · Current turn':'')+'</small></div><b class="ws-score">'+score+'</b></article>';}).join('');
 const rack=Array.from({length:p.rackSize},(_,i)=>{if(state.status==='reconnecting')return '<span class="ws-rack-empty" aria-hidden="true"></span>';const id=order.filter(id=>!used.has(id))[i],t=rackById.get(id);return t?'<button type="button" class="ws-rack-tile'+(selected===id||(state.exchange||[]).includes(id)?' ws-selected':'')+'" data-ws-tile="'+id+'" aria-pressed="'+(selected===id||(state.exchange||[]).includes(id))+'" aria-label="'+esc(t.symbol==='?'?'Blank, zero points':t.symbol+', '+t.value+' points')+'"'+(!playable?' disabled':'')+'>'+tile(t.symbol,t.symbol==='?')+'</button>':'<span class="ws-rack-empty" aria-hidden="true"></span>';}).join('');
 const turn=state.status==='reconnecting'?'Reconnecting — moves suspended':v.terminal?(v.winners.length>1?'Shared victory':v.winners.includes(s.viewerSeat)?'You win!':'Match complete'):playable?'Your turn':state.status==='submitting'?'Submitting move…':'Player '+(v.turn+1)+' is playing';
 return '<section class="ws-table" data-ws-session="'+esc(s.id)+'" aria-label="Word Salad gameplay"><header class="ws-header">'+img('logo/word-salad-logo.png','ws-logo','Word Salad')+'<div><p class="ws-eyebrow">BongGoggles · Restricted acceptance</p><h2>'+esc(p.name)+' · '+n+' × '+n+'</h2><p>'+esc(s.format.mode.replaceAll('-',' '))+' · '+esc(s.format.timing)+' · Revision '+s.sequence+'</p><a href="/games/scrabble/history" data-route="classic-game">My matches</a></div></header><div class="ws-layout"><div class="ws-play"><div class="ws-board-scroll" tabindex="0" aria-label="Playing board, scroll to inspect"><div class="ws-board ws-size-'+n+'" aria-label="'+n+' by '+n+' board">'+cells+'</div></div><div class="ws-rack" aria-label="Your letter rack">'+rack+'</div><p class="ws-instruction">Select a tile, then an empty square. Select a draft square to recall its tile. The server validates every word.</p><label class="ws-blank-picker">Blank letter <select data-ws-blank>'+Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ',c=>'<option'+(c===(state.blank||'A')?' selected':'')+'>'+c+'</option>').join('')+'</select></label></div><aside class="ws-side"><div class="ws-turn" role="status">'+esc(turn)+'</div><section class="ws-panel"><h3>Scoreboard</h3>'+players+'</section><section class="ws-panel ws-bag"><h3>Tile bag</h3><strong>'+v.bagCount+'</strong> remaining · '+p.tileCount+' total</section><div class="ws-feedback" aria-live="polite">'+(state.error?'<p class="ws-error" role="alert">'+esc(state.error)+'</p>':state.notice?'<p class="ws-success">'+esc(state.notice)+'</p>':'<p>Awaiting your next word.</p>')+'</div><section class="ws-panel ws-controls" aria-label="Move controls">'+control('play-word','Play Word',!playable||!Object.keys(draft).length,true)+control('shuffle','Shuffle',!playable,true)+control('exchange',state.exchangeMode?'Confirm Exchange':'Exchange',!playable||v.bagCount<p.rackSize,true)+control('recall','Recall',!playable||!Object.keys(draft).length)+control('pass','Pass',!playable,true)+control('resign','Resign',v.terminal||v.forfeit[s.viewerSeat]||state.status!=='ready')+'<button type="button" data-salad-refresh>Refresh match</button></section><details class="ws-panel"><summary>Help &amp; scoring</summary><p>Hybrids occupy one square; blanks score zero. Fresh premiums apply once. Cannabis words double the word score except in Straight Greens. Use every rack tile for '+p.allRackBonus+' bonus points.</p>'+Object.values(premiums).map(info=>'<p>'+esc(info[1])+'</p>').join('')+'</details></aside></div></section>';
}
// Reconcile only the mounted tabletop. Preserve unchanged image nodes, cells,
// focus, scroll and listeners. Templates are inert until a node is inserted.
function reconcile(old,next){
 if(old.nodeType!==next.nodeType||old.nodeName!==next.nodeName){old.replaceWith(next.cloneNode(true));return;}
 if(old.nodeType===3){if(old.nodeValue!==next.nodeValue)old.nodeValue=next.nodeValue;return;}
 if(old.nodeType!==1)return;
 for(const a of [...old.attributes])if(!next.hasAttribute(a.name)&&!(old.tagName==='DETAILS'&&a.name==='open'))old.removeAttribute(a.name);
 for(const a of next.attributes)if(old.getAttribute(a.name)!==a.value)old.setAttribute(a.name,a.value);
 if(old.tagName==='IMG')return;
 const selected=next.tagName==='SELECT'?next.value:null;
 const a=[...old.childNodes],b=[...next.childNodes];
 for(let i=0;i<b.length;i++)if(a[i])reconcile(a[i],b[i]);else old.append(b[i].cloneNode(true));
 for(let i=b.length;i<a.length;i++)a[i].remove();
 if(selected!==null&&old.value!==selected)old.value=selected;
}
export function updateSaladTable(root,state){
 const table=root.querySelector('.ws-table');
 if(!table||!state?.session||table.dataset.wsSession!==state.session.id)return false;
 const html=renderSaladTable(state);if(!html)return false;
 const template=root.ownerDocument.createElement('template');template.innerHTML=html;
 reconcile(table,template.content.firstElementChild);return true;
}
const bound=new WeakSet();
export function bindSaladTable(root,c,win){
 const table=root.querySelector('.ws-table');if(!table||bound.has(table))return;bound.add(table);
 table.addEventListener('change',e=>{if(e.target.matches('[data-ws-blank]'))c.emit({blank:e.target.value});});
 table.addEventListener('click',e=>{
 const el=e.target.closest('button');if(!el||el.disabled||!table.contains(el))return;
 if(el.matches('[data-salad-refresh]')){void c.refresh(c.target);return;}
 if(el.matches('[data-ws-tile]')){const id=Number(el.dataset.wsTile);if(!c.canPlay())return;if(c.state.exchangeMode){const ids=new Set(c.state.exchange);ids.has(id)?ids.delete(id):ids.add(id);c.emit({exchange:[...ids]});}else c.select(id);return;}
 if(el.matches('[data-ws-cell]')){if(!c.canPlay()||c.state.exchangeMode)return;const q=Number(el.dataset.wsCell);if(c.state.selected!==null)c.place(q,c.state.blank||'A');else if(c.state.draft[q])c.recall(q);return;}
 const a=el.dataset.wsAction;if(a==='resign'){if(win.confirm('Resign this match?'))void c.act(undefined,'resign');return;}if(!c.canPlay())return;
 if(a==='recall'){c.recall();c.emit({exchangeMode:false});}else if(a==='shuffle'){const order=c.state.session.privateView.rack.map(t=>t.id);for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}c.emit({order});}else if(a==='play-word'){void c.act({type:'place',tiles:Object.values(c.state.draft)});}else if(a==='pass'){if(win.confirm('Pass this turn?'))void c.act({type:'pass'});}else if(a==='exchange'){if(!c.state.exchangeMode){c.recall();c.emit({exchangeMode:true,exchange:[],selected:null});}else if(c.state.exchange.length&&win.confirm('Exchange selected tiles?')){void c.act({type:'exchange',ids:c.state.exchange});}else if(!c.state.exchange.length)c.emit({exchangeMode:false});}
 });
}
