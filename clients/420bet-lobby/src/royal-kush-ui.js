import {createRoyalKush,royalKushAction,RK_PAY} from './royal-kush-engine.js';
import {blackjackCardArt,blackjackCardBack} from './blackjack-card-art.js';
const el=(d,t,c,txt)=>{const n=d.createElement(t);if(c)n.className=c;if(txt!==undefined)n.textContent=txt;return n;};
const demo=Object.freeze([{rank:'K',suit:'♠'},{rank:'Q',suit:'♥'},{rank:'10',suit:'♣'},{rank:'J',suit:'♠'},{rank:'A',suit:'♥'}]);
const number=n=>n.toLocaleString('en-US');
export function createRoyalKushTable(doc=globalThis.document,options={}){
 const game=createRoyalKush(options),root=el(doc,'section','rk-casino');
 root.dataset.practiceGame='video-poker';root.gameState=game;
 const shell=el(doc,'div','rk-shell');
 const top=el(doc,'header','rk-title');
 top.append(el(doc,'div','rk-leaf rk-left-leaf','✦'),el(doc,'div','rk-title-stack'));
 const title=top.querySelector('.rk-title-stack');
 title.append(el(doc,'div','rk-title-brand','420BET ORIGINALS'),el(doc,'h1','','Royal Kush'),el(doc,'div','rk-title-ribbon','♠ VIDEO POKER ♠'));
 top.append(el(doc,'div','rk-leaf rk-right-leaf','✦'));
 const pay=el(doc,'section','rk-paytable');
 pay.setAttribute('aria-label','Royal Kush Jacks or Better paytable');
 const grid=el(doc,'div','rk-pay-grid');
 const header=el(doc,'div','rk-pay-header');
 header.append(el(doc,'span','','HAND'));
 for(let i=1;i<=5;i++)header.append(el(doc,'span','rk-pay-col'+(i===5?' rk-col5':''),'BET '+i));
 grid.append(header);
 for(const [idx,p] of RK_PAY.entries()){
  const row=el(doc,'div','rk-pay-row');
  row.dataset.hand=p.key;
  row.append(el(doc,'span','rk-pay-label',(['♛','✦','♣','⌂','✧','◆','♣','●','★'][idx])+'  '+p.name));
  for(let bet=1;bet<=5;bet++)row.append(el(doc,'span','rk-pay-value'+(bet===5?' rk-col5':''),number(p.unit*bet)));
  grid.append(row);
 }
 pay.append(grid);
 const board=el(doc,'div','rk-card-board');
 board.setAttribute('aria-label','Five-card draw poker hand');
 const seats=Array.from({length:5},(_,i)=>{
  const wrap=el(doc,'div','rk-card-slot');wrap.dataset.slot=String(i);
  const held=el(doc,'div','rk-hold-tag','✦ HOLD ✦');
  const btn=el(doc,'button','rk-card');
  btn.type='button';btn.setAttribute('aria-label','Card '+(i+1)+' hold toggle');
  const img=el(doc,'img','rk-card-art');img.alt='';img.draggable=false;
  img.addEventListener('error',()=>wrap.classList.add('rk-card-missing'));
  const fb=el(doc,'span','rk-card-fallback');
  btn.append(img,fb);
  btn.addEventListener('click',()=>{if(royalKushAction(game,'hold',i))draw();});
  wrap.append(held,btn);board.append(wrap);
  return {wrap,btn,img,fb};
 });
 const stats=el(doc,'div','rk-stats');
 const win=el(doc,'div','rk-stat rk-win');
 win.append(el(doc,'span','','WIN'),el(doc,'strong','','0'));
 const wager=el(doc,'div','rk-stat rk-bet');wager.append(el(doc,'span','','BET'),el(doc,'strong','','5'));
 const credit=el(doc,'div','rk-stat rk-credit');credit.append(el(doc,'span','','CREDITS (PRACTICE)'),el(doc,'strong','',number(game.credits)));
 stats.append(win,wager,credit);
 const controls=el(doc,'div','rk-controls');
 function action(label,cls,fn){const b=el(doc,'button',cls,label);b.type='button';b.addEventListener('click',fn);return b;}
 const help=action('? HELP','rk-btn rk-help',()=>{popup.hidden=false;});
 const collect=action('◉ COLLECT','rk-btn rk-collect',()=>{royalKushAction(game,'refill');draw();});
 const minus=action('−','rk-btn rk-adjust',()=>{royalKushAction(game,'bet',Math.max(1,game.bet-1));draw();});
 const plus=action('+','rk-btn rk-adjust',()=>{royalKushAction(game,'bet',Math.min(5,game.bet+1));draw();});
 const betOne=action('BET ONE','rk-btn rk-bet-one',()=>{royalKushAction(game,'bet-one');draw();});
 const betMax=action('✦ BET MAX','rk-btn rk-bet-max',()=>{royalKushAction(game,'bet-max');draw();});
 const deal=action('♠ DEAL','rk-btn rk-deal',()=>{
   if(game.phase==='draw')royalKushAction(game,'draw');
   else royalKushAction(game,'deal');
   draw();
 });
 const betAdjust=el(doc,'div','rk-bet-adjust');betAdjust.append(minus,el(doc,'strong','rk-bet-number',String(game.bet)),plus);
 controls.append(help,collect,betAdjust,betOne,betMax,deal);
 const status=el(doc,'p','rk-message','');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const disclaimer=el(doc,'div','rk-footer','420BET ORIGINALS · PRACTICE ONLY · NO REAL WAGERS OR REWARDS');
 const popup=el(doc,'div','rk-help-overlay');popup.hidden=true;
 const dialog=el(doc,'section','rk-help-dialog');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-label','Royal Kush rules');
 dialog.append(el(doc,'h2','','ROYAL KUSH · HOW TO PLAY'),
 el(doc,'p','','This is practice-only five-card Jacks or Better draw poker. Choose a bet of 1–5 credits and press DEAL. Select any cards to HOLD, then press DRAW to replace the rest. The paytable above lists credits returned for each winning hand. No wallet or real-money transactions are enabled.'),
 action('CLOSE','rk-btn rk-bet-one',()=>{popup.hidden=true;}));
 popup.append(dialog);popup.addEventListener('click',e=>{if(e.target===popup)popup.hidden=true;});
 shell.append(top,pay,board,stats,controls,status,disclaimer,popup);root.append(shell);
 function draw(){
  const cards=game.hand.length===5?game.hand:demo;
  seats.forEach(({wrap,btn,img,fb},i)=>{
   const c=cards[i];wrap.classList.toggle('rk-held',game.held[i]&&game.phase==='draw');
   btn.disabled=game.phase!=='draw';img.src=blackjackCardArt(c);
   img.alt=c.rank+' of '+({'♠':'spades','♥':'hearts','♦':'diamonds','♣':'clubs'})[c.suit];
   fb.textContent=c.rank+c.suit;
  });
  const betCols=grid.querySelectorAll('.rk-pay-col,.rk-pay-value');
  betCols.forEach(n=>{const col=Array.from(n.parentNode.children).indexOf(n);n.classList.toggle('rk-active-pay',col===game.bet);});
  grid.querySelectorAll('.rk-pay-row').forEach(row=>row.classList.toggle('rk-win-row',!!game.lastHand&&row.querySelector('.rk-pay-label')?.textContent.includes(game.lastHand)));
  win.querySelector('strong').textContent=number(game.win);wager.querySelector('strong').textContent=String(game.bet);credit.querySelector('strong').textContent=number(game.credits);betAdjust.querySelector('strong').textContent=String(game.bet);
  status.textContent=game.message;
  deal.textContent=game.phase==='draw'?'♠ DRAW':'♠ DEAL';
  deal.disabled=game.phase!=='draw'&&game.credits<game.bet;
  [minus,plus,betOne,betMax].forEach(b=>b.disabled=game.phase==='draw');
  collect.disabled=game.phase==='draw';
 }
 draw();root.stopAnimation=()=>{};return root;
}
