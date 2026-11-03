import {BASE_REELS,PAYLINES,PAY_SYMBOLS,BASE_PAYTABLE,BONUS_PAYTABLE,SYMBOL_NAMES,MAX_PAYOUT_X,MAX_BUZZ,CYCLE_LENGTH} from './mary-jane-model.js';
import {initialMaryJaneState,spinMaryJane,setMaryJaneStake,visibleMaryJaneReels,creditText} from './mary-jane-engine.js';

const ART_ROOT='/assets/420bet/mary-jane/';
const GLYPHS={H02:'★',H03:'420',H04:'💍',H05:'◉',H06:'THC BAR',L01:'🌿',L02:'▤',L03:'⌁',L04:'🔥',L05:'🚬',L06:'♧',WILD:'💋',COIN:'✽',SCATTER:'420'};
const make=(doc,tag,cls='',txt)=>{const e=doc.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;};
export function createMaryJanePractice(doc=globalThis.document){
 let state=initialMaryJaneState(),activePanel=null,auto=false,autoLeft=0,timer=null,destroyed=false,turbo=false;
 const view=doc.defaultView||globalThis;
 const root=make(doc,'section','mary-jane-game');root.dataset.practiceGame='mary-jane-sticky-wilds';
 const button=(txt,cls,fn)=>{const b=make(doc,'button',cls,txt);b.type='button';b.addEventListener('click',fn);return b;};
 const stopTimer=()=>{if(timer!==null&&typeof view.clearTimeout==='function')view.clearTimeout(timer);timer=null;};
 function stopAnimation(){destroyed=true;auto=false;autoLeft=0;stopTimer();}
 root.stopAnimation=stopAnimation;
 const schedule=fn=>{if(destroyed)return;if(typeof view.setTimeout==='function'){stopTimer();timer=view.setTimeout(()=>{timer=null;if(!destroyed)fn();},turbo?100:700);}};
 const autoContinue=()=>{
  if(state.mode==='bonus'){schedule(step);return;}
  if(auto&&autoLeft>0&&state.balanceMicros>=state.stake*1000000)schedule(step);
  else if(auto){auto=false;autoLeft=0;render();}
 };
 function step(){
  if(destroyed)return;
  if(state.mode==='base'){if(auto&&autoLeft>0)autoLeft--;}
  try{state=spinMaryJane(state);}catch(error){auto=false;autoLeft=0;state={...state,message:error.message};}
  render();autoContinue();
 }
 const ART_INDEX=Object.freeze({H02:0,H03:1,H04:2,H05:3,H06:4,L01:5,L02:6,L03:7,L04:8,L05:9,L06:10,WILD:11,COIN:12,SCATTER:13});
 function symbolCell(symbol,reel,row,mask,converted,sticky){
  const normalized=symbol?.startsWith('H01')?'H01':symbol;
  const cell=make(doc,'div','mj-cell'+(mask?' mj-framed':'')+(converted?' mj-converted':'')+(sticky?' mj-sticky':''));
  cell.setAttribute('role','img');
  cell.setAttribute('aria-label','Reel '+(reel+1)+' row '+(row+1)+': '+(SYMBOL_NAMES[normalized]||'Empty'));
  if(symbol?.startsWith('H01')){
   const slice=make(doc,'div','mj-portrait-part');
   const img=make(doc,'img');img.src=ART_ROOT+'mj-portrait-art.webp';img.alt='';
   img.style.top='-'+('ABCD'.indexOf(symbol.at(-1))*100)+'%';slice.append(img);cell.append(slice);
  }else if(normalized&&ART_INDEX[normalized]!==undefined){
   const i=ART_INDEX[normalized],art=make(doc,'span','mj-symbol-art');
   art.setAttribute('aria-hidden','true');
   art.style.backgroundPosition=((i%4)*100/3)+'% '+(Math.floor(i/4)*100/3)+'%';
   cell.append(art);
  }
  return cell;
 }
 function showInfo(){
  const overlay=make(doc,'div','es-info-overlay mj-overlay');
  const panel=make(doc,'section','mj-modal');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
  panel.setAttribute('aria-label',activePanel==='info'?"Mary Jane's Sticky Wilds rules and paytable":"Mary Jane's menu");
  const close=button('×','mj-close',()=>{activePanel=null;render();});close.setAttribute('aria-label','Close game information');
  const heading=make(doc,'h2','',activePanel==='info'?"MARY JANE'S STICKY WILDS — INFO":"PRACTICE MENU");panel.append(close,heading);
  if(activePanel==='info'){
   panel.append(make(doc,'p','',"5 reels × 4 rows · 20 permanently active paylines. Match 3, 4 or 5 symbols left to right. Every award below is multiplied by BET PER LINE (TOTAL BET ÷ 20). This is practice play with no cash value."));
   panel.append(make(doc,'h3','','GOLD LEAF FRAMES'));
   panel.append(make(doc,'p','',"A Gold Cannabis Coin pays on its own lines and frames its position. A Coin landing on an already framed cell increases Buzz by +1, up to ×10. All frames turn into Mary Jane Wilds on the tenth paid spin; then the cycle restarts. Wilds never substitute for Coins or Scatters."));
   panel.append(make(doc,'h3','','STICKY WILD FREE SPINS'));
   panel.append(make(doc,'p','',"Two 420 Scatters are present on each of reels 1, 3 and 5. One visible Scatter on each triggers 10 free spins. The triggering Buzz multiplier carries into the feature. Natural Wilds stick in place for the rest of those 10 spins. Free spins use independent reels and a separate, higher-paying paytable; they contain no Gold Coins or Scatters. The base cycle pauses for the bonus."));
   panel.append(make(doc,'h3','','MAXIMUM AWARD'));
   panel.append(make(doc,'p','',"MAX WIN "+MAX_PAYOUT_X+"× TOTAL BET across one paid spin and the free spins it triggers. Once that gross cap is reached, further bonus awards are zero. Buzz cannot exceed ×"+MAX_BUZZ+"."));
   panel.append(make(doc,'h3','','BASE & STICKY FREE SPINS PAYTABLE'));
   const table=make(doc,'table','mj-paytable');const head=make(doc,'tr');for(const name of ['SYMBOL','BASE 3','BASE 4','BASE 5','FREE 3','FREE 4','FREE 5'])head.append(make(doc,'th','',name));table.append(head);
   for(const key of PAY_SYMBOLS){const row=make(doc,'tr');row.append(make(doc,'th','',SYMBOL_NAMES[key]));for(const amount of [...BASE_PAYTABLE[key],...BONUS_PAYTABLE[key]])row.append(make(doc,'td','',amount.toFixed(2)+'×'));table.append(row);}panel.append(table);
   panel.append(make(doc,'h3','','ALL 20 PAYLINES'));panel.append(make(doc,'p','',"Rows are numbered 1–4 from top to bottom. Each line shows the row used on reels 1–5."));
   const paths=make(doc,'div','mj-line-list');
   for(const [index,line] of (awaitlessPaylines()).entries())paths.append(make(doc,'span','',String(index+1).padStart(2,'0')+' · '+line.map(r=>r+1).join('–')));
   panel.append(paths);
   panel.append(make(doc,'p','mj-disclaimer',"RTP ~95% is a v4 Monte Carlo estimate, NOT certified exact theoretical RTP. Practice credits cannot be deposited, withdrawn or exchanged."));
  }else{
   panel.append(make(doc,'p','',"AUTO PLAY runs at most 25 paid spins and any triggered bonus; TURBO shortens animations only. Change stakes with −/+ between paid spins."));
   const reset=button('RESET PRACTICE CREDITS','mj-action',()=>{if(state.mode==='bonus')return;stopTimer();auto=false;autoLeft=0;state=initialMaryJaneState();activePanel=null;render();});
   reset.disabled=state.mode==='bonus';panel.append(reset);
  }
  overlay.append(panel);
  overlay.addEventListener('click',e=>{if(e.target===overlay){activePanel=null;render();}});
  overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();activePanel=null;render();}});
  root.append(overlay);
 }
 function awaitlessPaylines(){return PAYLINES;}
 function render(){
  if(destroyed)return;
  root.replaceChildren();
  root.classList.add('mj-concept');
  const scene=make(doc,'div','mj-scene');
  scene.setAttribute('role','group');
  scene.setAttribute('aria-label',"Mary Jane's Sticky Wilds interactive slot cabinet");
  scene.append(make(doc,'span','mj-assistive','MAX WIN '+MAX_PAYOUT_X+'× TOTAL BET'));
  const board=state.lastStops?state.lastBoard:visibleMaryJaneReels(BASE_REELS,[0,9,17,30,42]);
  const reels=make(doc,'div','mj-reels');
  for(let r=0;r<5;r++){
   const reel=make(doc,'div','mj-reel');
   for(let row=0;row<4;row++)
    reel.append(symbolCell(board[r][row],r,row,state.lastStops?state.lastFrames[r][row]:false,state.lastConverted[r][row],state.mode==='bonus'&&state.sticky[r][row]));
   reels.append(reel);
  }
  scene.append(reels);
  const positionText=(cls,value,label)=>{
   const el=make(doc,'div','mj-live '+cls,value);
   if(label)el.setAttribute('aria-label',label);
   scene.append(el);return el;
  };
  positionText('mj-live-cycle',state.mode==='bonus'?'FREE '+state.freeRemaining+' OF 10':'SPIN '+(state.cycle===0?10:state.cycle)+' OF 10','Gold Leaf Frames progress');
  positionText('mj-live-buzz','×'+(state.mode==='bonus'?state.bonusBuzz:state.buzz),'Buzz Multiplier');
  positionText('mj-live-bet',(state.stake/20).toFixed(2),'Practice bet per payline');
  positionText('mj-live-total',state.stake.toFixed(2),'Total practice bet');
  positionText('mj-live-win',creditText(state.lastWinMicros),'Last practice win');
  positionText('mj-live-balance',creditText(state.balanceMicros),'Practice-credit balance');
  const message=positionText('mj-message',state.message);
  message.setAttribute('role','status');
  const hit=(cls,label,fn)=>{
   const b=button('','mj-hit mj-control '+cls,fn);
   b.setAttribute('aria-label',label);b.setAttribute('title',label);
   scene.append(b);return b;
  };
  hit('mj-hit-info','Open gameplay, bonuses and paytable',()=>{activePanel='info';render();});
  hit('mj-hit-menu','Open practice game menu',()=>{activePanel='menu';render();});
  const sound=hit('mj-hit-sound','Audio unavailable in this practice version',()=>{});
  sound.disabled=true;
  const minus=hit('mj-hit-minus','Decrease total bet',()=>{state=setMaryJaneStake(state,state.stake-1);render();});
  minus.disabled=state.stake<=1||state.mode==='bonus'||auto;
  const plus=hit('mj-hit-plus','Increase total bet',()=>{state=setMaryJaneStake(state,state.stake+1);render();});
  plus.disabled=state.stake>=50||state.mode==='bonus'||auto;
  const spin=button('','mj-hit mj-spin mj-hit-spin',step);
  spin.setAttribute('aria-label',state.mode==='bonus'?'Advance free spin':'Spin Mary Jane reels');
  spin.setAttribute('title',state.mode==='bonus'?'Advance free spin':'Spin');
  spin.disabled=(state.mode==='base'&&state.balanceMicros<state.stake*1000000)||auto;
  scene.append(spin);
  const autoButton=hit('mj-hit-auto','Auto play 25 paid spins',()=>{
   auto=!auto;autoLeft=auto?25:0;stopTimer();render();if(auto)autoContinue();
  });autoButton.setAttribute('aria-pressed',String(auto));
  if(auto)autoButton.classList.add('mj-activated');
  const turboButton=hit('mj-hit-turbo','Toggle turbo spin speed',()=>{turbo=!turbo;render();});
  turboButton.setAttribute('aria-pressed',String(turbo));
  if(turbo)turboButton.classList.add('mj-activated');
  root.append(scene);
  const legal=make(doc,'p','mj-legal','PRACTICE CREDITS ONLY · NO WALLET · NO REAL WAGERING · NOT CERTIFIED PRODUCTION ODDS');
  legal.setAttribute('aria-label','Practice credits only; no real money or wallet transactions');root.append(legal);
  if(activePanel)showInfo();
 }

 render();
 return root;
}
