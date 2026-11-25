import {renderChessSocial} from './chess-social.js';
import {escapeHtml as esc} from './design-system.js';
const names={k:'king',q:'queen',r:'rook',b:'bishop',n:'knight',p:'pawn'};
const art='/assets/games/chess/';
const piece=p=>p==='.'?'':'<img class="chess-piece" src="'+art+'pieces/'+(p===p.toUpperCase()?'white':'black')+'-'+names[p.toLowerCase()]+'.webp" alt="" draggable="false">';
const logo='<h2 class="chess-title"><img src="'+art+'chess-logo.webp" alt="BongGoggles Chess"></h2>';
const square=i=>'abcdefgh'[i%8]+(1+Math.floor(i/8));
const colour=i=>['White','Black'][i];
const button=(label,attr,disabled=false)=>'<button type="button" '+attr+(disabled?' disabled':'')+'>'+esc(label)+'</button>';
const help='<details class="chess-help"><summary>How to play Chess</summary><p>White moves first. Select your piece, then a highlighted legal destination. Checkmate wins; stalemate, approved insufficient material, repetition and move-count rules can draw. Castling and en passant appear only when legal. Promotion offers queen, rook, bishop or knight. A draw offer accompanies a move; a draw claim is available only when the server permits it. Resigning loses the match. Clocks and results are server-authoritative.</p><p>Keyboard: Tab to a square, Enter or Space to select. Arrow keys move focus between squares. Escape clears the selection.</p></details>';
export function renderChessScreen(screen,state={}){
 const s=state.session,v=s?.view,actions=state.actions??[],ready=state.status==='ready';
 const nav='<nav class="games-screen__nav" aria-label="Chess screens">'+['intro','rules','setup','play','history'].map(x=>'<a data-route="classic-game" href="/games/chess'+(x==='intro'?'':'/'+x)+'">'+({intro:'Overview',rules:'Help',setup:'Opponents',play:'Play',history:'My Games'})[x]+'</a>').join('')+'</nav>';
 const error=state.error?'<p role="alert">'+esc(state.error)+'</p>':'';
 const matches=(state.matches??[]).map(m=>'<li><a href="/games/chess/play?session='+esc(m.id)+'" data-route="classic-game">'+(m.status==='active'?'Resume game':'Review completed game')+' · '+esc(m.id.slice(0,8))+'</a></li>').join('');
 const setup='<form data-chess-start><h3>Play against a computer</h3><label>Opponent <select name="difficulty"><option value="easy">Computer — Easy</option><option value="medium" selected>Computer — Medium</option><option value="hard">Computer — Hard</option></select></label><label>Clock <select name="clockProfile">'+['untimed','1+0','2+1','3+0','3+2','5+0','5+3','10+0','15+10','30+0','30+30','60+0'].map(x=>'<option>'+x+'</option>').join('')+'</select></label><button class="chess-start" type="submit"'+(!ready?' disabled':'')+'>Start Chess</button></form><p>You play White against a computer. For a human opponent, <a href="/games/rooms" data-route="classic-rooms">create or join a Chess room</a>.</p>';
 if(!v)return '<section class="chess-screen">'+logo+nav+'<p role="status">'+(state.status==='disabled'?'Chess is not enabled for this deployment.':state.status==='guest'?'Sign in with 420ID to play.':state.status==='unavailable'?'Chess session unavailable.':'Chess · two players · no wagers')+'</p>'+error+(state.status==='guest'?'<a href="/social-api/auth/start">Sign in with 420ID</a>':'')+(screen==='rules'?help:'<div class="chess-layout"><div class="chess-board-frame"><div class="chess-board" aria-label="Starting position preview">'+Array.from({length:64},(_,n)=>{const p='rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR'[n];return '<div class="chess-square '+((Math.floor(n/8)+n%8)%2?'dark':'light')+'"><span>'+piece(p)+'</span></div>';}).join('')+'</div></div><aside>'+setup+'</aside></div>')+'<h3>My Games</h3><ul>'+matches+'</ul>'+renderChessSocial(state.social)+help+'</section>';
 const flipped=state.flipped??s.seat===1,order=Array.from({length:64},(_,n)=>flipped?(n>>3)*8+7-n%8:(7-(n>>3))*8+n%8);
 const moves=actions.filter(a=>a.type==='move');
 const targets=new Set(moves.filter(a=>a.uci.slice(0,2)===state.selected).map(a=>a.uci.slice(2,4)));
 const sources=new Set(moves.map(a=>a.uci.slice(0,2)));
 const board=order.map(i=>{const sq=square(i),p=v.board[i],last=v.lastMove&&(v.lastMove.slice(0,2)===sq||v.lastMove.slice(2,4)===sq);
  const label=sq+(p==='.'?', empty':', '+(p===p.toUpperCase()?'White ':'Black ')+names[p.toLowerCase()]);
  return '<button type="button" class="chess-square '+((i%8+(i>>3))%2?'light':'dark')+(last?' last':'')+(state.selected===sq?' selected':'')+(targets.has(sq)?' target':'')+'" data-chess-square="'+sq+'" aria-label="'+esc(label+(targets.has(sq)?', legal destination':''))+'" aria-pressed="'+(state.selected===sq)+'" aria-disabled="'+(!ready||(!sources.has(sq)&&!targets.has(sq)))+'"><span aria-hidden="true">'+piece(p)+'</span><small aria-hidden="true">'+sq+'</small></button>';}).join('');
 const status=v.terminal?(v.winner===null?'Draw':colour(v.winner)+' wins')+' · '+v.reason:colour(v.turn)+' to move'+(v.check?' · Check':'')+(v.turn===s.seat?' · Your turn':' · Waiting for opponent');
 const controls=actions.filter(a=>!['move','move-offer'].includes(a.type)).map(a=>button(a.type==='claim-draw'?'Claim draw'+(a.uci?' with '+a.uci:''):({'resign':'Resign','accept-draw':'Accept draw','reject-draw':'Decline draw'})[a.type],'data-chess-action="'+a.type+'" data-uci="'+esc(a.uci??'')+'"',!ready)).join('');
 const promotions=(state.promotion??[]).map(a=>button(({q:'Queen',r:'Rook',b:'Bishop',n:'Knight'})[a.uci.at(-1)],'data-chess-promotion="'+a.uci+'"',!ready)).join('');
 return '<section class="chess-screen">'+logo+nav+'<p role="status" aria-live="polite">'+esc(status)+'</p>'+error+'<div class="chess-layout"><div><div class="chess-board-frame'+(flipped?' flipped':'')+'"><div class="chess-board" aria-label="Chess board">'+board+'</div></div><p>Last move: '+esc(v.lastSAN||'None')+'</p></div><aside><h3>Match controls</h3><p>You are '+colour(s.seat)+'</p><p class="chess-clock'+(v.turn===0?' active':'')+'" data-chess-clock="0">White clock</p><p class="chess-clock'+(v.turn===1?' active':'')+'" data-chess-clock="1">Black clock</p><div class="chess-history"><h3>Move History</h3><p>'+esc(v.lastSAN||'No moves yet.')+'</p></div>'+button('Flip board','data-chess-flip')+button('Clear selection','data-chess-clear')+(actions.some(a=>a.type==='move-offer')?'<label><input type="checkbox" data-chess-offer '+(state.offer?'checked':'')+'> Offer draw with next move</label>':'')+(promotions?'<div role="group" aria-label="Choose promotion">'+promotions+'</div>':'')+controls+help+'</aside></div>'+renderChessSocial(state.social,s)+'</section>';
}
export function bindChessScreen(root,c,win){
 const choose=a=>{const type=c.state.offer&&c.state.actions.some(x=>x.type==='move-offer'&&x.uci===a.uci)?'move-offer':'move';void c.act({type,uci:a.uci});};
 for(const b of root.querySelectorAll('[data-chess-square]')){
  b.addEventListener('click',()=>{if(c.state.status!=='ready')return;const sq=b.dataset.chessSquare,m=c.state.actions.filter(a=>a.type==='move'),choices=m.filter(a=>a.uci.slice(0,2)===c.state.selected&&a.uci.slice(2,4)===sq);
   if(choices.length>1)c.emit({promotion:choices});else if(choices.length===1)choose(choices[0]);else if(m.some(a=>a.uci.startsWith(sq)))c.emit({selected:sq,promotion:[]});
   root.querySelector('[data-chess-square="'+sq+'"]')?.focus();});
  b.addEventListener('keydown',e=>{const keys={ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8};if(e.key==='Escape'){c.emit({selected:null,promotion:[]});return;}if(!(e.key in keys))return;e.preventDefault();const all=[...root.querySelectorAll('[data-chess-square]')];all[all.indexOf(b)+keys[e.key]]?.focus();});
 }
 for(const b of root.querySelectorAll('[data-chess-promotion]'))b.onclick=()=>choose({uci:b.dataset.chessPromotion});
 for(const b of root.querySelectorAll('[data-chess-action]'))b.onclick=()=>{if(b.dataset.chessAction==='resign'&&!win.confirm('Resign this Chess match?'))return;void c.act({type:b.dataset.chessAction,...(b.dataset.uci?{uci:b.dataset.uci}:{})});};
 root.querySelector('[data-chess-flip]')?.addEventListener('click',()=>c.emit({flipped:!(c.state.flipped??c.state.session?.seat===1)}));
 root.querySelector('[data-chess-clear]')?.addEventListener('click',()=>c.emit({selected:null,promotion:[]}));
 root.querySelector('[data-chess-offer]')?.addEventListener('change',e=>c.emit({offer:e.target.checked}));
}
