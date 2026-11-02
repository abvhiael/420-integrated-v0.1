import {initial,next} from './practice-engine.js';
export const SLOT_SYMBOLS=Object.freeze(['BUD','GRINDER','LIGHTER','BONG','CHIPS','WILD','SCATTER']);
export function slotWays(board){
 if(!Array.isArray(board)||board.length!==20)return [];
 const wins=[];
 for(let symbol=0;symbol<5;symbol++){
  let ways=1,reels=0,positions=[];
  for(let c=0;c<5;c++){
   const cells=[];for(let row=0;row<4;row++){const index=row*5+c;if(board[index]===symbol||board[index]===5)cells.push(index);}
   if(!cells.length)break;
   ways*=cells.length;reels++;positions.push(...cells);
  }
  if(reels>=3)wins.push({symbol,reels,ways,positions});
 }
 return wins;
}
export function slotFeatureEligible(board){return board.filter(v=>v===6).length>=3;}
const SYMBOL_MARKS=['✿','◈','♨','♧','♠','✳','✦'];
export function createEmeraldSlots(doc=globalThis.document){
 let state=initial('slots'),spinning=false,freeRemaining=0,freeAwarded=0,lastWins=[],featureMessage='',shown=Array(20).fill(-1),timer=null;
 const view=doc.defaultView||{},root=doc.createElement('section');root.className='practice emerald-slots';root.dataset.practiceGame='slots';
 const node=(tag,cls,content)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(content!==undefined)n.textContent=content;return n;};
 const stop=()=>{if(timer!==null){view.clearTimeout?.(timer);timer=null;}spinning=false;};
 root.stopAnimation=stop;
 const draw=()=>{
  root.replaceChildren();
  const hdr=node('header','es-header');hdr.append(node('div','es-brand','420Bet'),node('div','es-subtitle','EMERALD HARVEST'),node('div','es-ways','✦ 1024 WAYS TO WIN ✦'));root.append(hdr);
  const cabinet=node('div','es-cabinet'),inner=node('div','es-inner');
  const grid=node('div','es-reels');grid.setAttribute('role','img');grid.setAttribute('aria-label','Five reels, four visible rows');
  for(let i=0;i<20;i++){
   const value=shown[i],symbol=value>=0?SLOT_SYMBOLS[value]:'';
   const tile=node('div','es-symbol'+(spinning?' es-spinning':'')+(lastWins.some(w=>w.positions.includes(i))&&!spinning?' es-winning':'')+(value===5?' es-wild':'')+(value===6?' es-scatter':''));tile.dataset.symbol=String(value);
   if(value>=0){tile.append(node('span','es-symbol-mark',SYMBOL_MARKS[value]),node('span','es-symbol-name',symbol));}else{tile.append(node('span','es-symbol-mark','✳'));}
   grid.append(tile);
  }
  inner.append(grid);const banner=node('div','es-feature-banner',featureMessage);banner.setAttribute('aria-live','polite');inner.append(banner);cabinet.append(inner);
  const controls=node('div','es-controls'),stats=node('div','es-stats');
  for(const [label,value] of [['WAGER','0'],['PAYOUT','0'],['FREE SPINS',String(freeRemaining)],['PRACTICE BALANCE','—']]){const item=node('div','es-stat');item.append(node('small','',label),node('strong','',value));stats.append(item);}
  const spin=node('button','es-spin',spinning?'SPINNING…':freeRemaining?'FREE SPIN ✦':'✦ SPIN ✦');spin.type='button';spin.disabled=spinning;spin.addEventListener('click',play);controls.append(stats,spin);cabinet.append(controls);root.append(cabinet);
  const details=node('section','es-details');details.append(node('p','es-notice','PRACTICE ONLY · NO WALLET · NO REAL WAGERS · NO CREDITS · NO PAYOUTS · No funds involved'));
  const detailsText=spinning?'Reels spinning…':lastWins.length?'Simulated ways: '+lastWins.map(w=>SLOT_SYMBOLS[w.symbol]+' '+w.reels+' reels / '+w.ways+' ways').join(' · '):'No winning ways displayed on this spin.';
  details.append(node('p','es-outcome',detailsText),node('p','es-disclaimer','Visual practice preview. Symbol draws are not canonical reel-strip outcomes; free-spin demonstration is not a certified paytable or RTP.'));
  root.append(details);
 };
 const finish=()=>{
  shown=[...state.result];spinning=false;lastWins=slotWays(shown);
  const triggered=slotFeatureEligible(shown);
  if(triggered){if(freeAwarded===0){freeRemaining+=6;freeAwarded=1;}else if(freeAwarded<3){freeRemaining+=3;freeAwarded++;}freeRemaining=Math.min(12,freeRemaining);featureMessage='✦ FREE SPINS FEATURE ✦ '+freeRemaining+' REMAINING · 2× FEATURE (PREVIEW)';}
  else if(freeRemaining>0){featureMessage='✦ FREE SPINS ✦ '+freeRemaining+' REMAINING · 2× FEATURE (PREVIEW)';}
  else featureMessage=lastWins.length?'✦ MATCHING WAYS ✦':'';
  draw();
 };
 const play=()=>{
  if(spinning)return;
  if(freeRemaining>0)freeRemaining--;else freeAwarded=0;
  state=next(state,{type:'play'});spinning=true;lastWins=[];featureMessage='';
  let tick=0;
  const animate=()=>{if(!spinning)return;tick++;
   shown=Array.from({length:20},()=>Math.floor(Math.random()*7));draw();
   if(tick<12){timer=view.setTimeout?.(animate,95+tick*15)??null;}else{timer=null;finish();}
  };
  if(view.matchMedia?.('(prefers-reduced-motion: reduce)').matches||!view.setTimeout){finish();return;}
  animate();
 };
 draw();return root;
}
