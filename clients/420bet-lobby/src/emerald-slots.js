import {EMERALD_ASSETS} from './emerald-slots-assets.js';
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

// Visual-only BIG WIN cue. Not a financial win: practice payouts remain zero.
export function emeraldCelebration(wins,scatterTriggered){
 if(scatterTriggered)return 'freeSpins';
 if(wins.some(w=>w.reels>=5&&w.ways>=4))return 'bigWin';
 return null;
}
export function createEmeraldSlots(doc=globalThis.document){
 let state=initial('slots'),spinning=false,freeRemaining=0,freeAwarded=0,lastWins=[],featureMessage='',shown=Array(20).fill(-1),timer=null,celebration=null,overlayTimer=null;
 const view=doc.defaultView||{},root=doc.createElement('section');root.className='practice emerald-slots';root.dataset.practiceGame='slots';
 const node=(tag,cls,content)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(content!==undefined)n.textContent=content;return n;};
 const clearOverlay=()=>{if(overlayTimer!==null){view.clearTimeout?.(overlayTimer);overlayTimer=null;}celebration=null;};
 const stop=()=>{if(timer!==null){view.clearTimeout?.(timer);timer=null;}clearOverlay();spinning=false;};
 root.stopAnimation=stop;
 const draw=()=>{
  root.replaceChildren();
  const hdr=node('header','es-header');hdr.append(node('div','es-brand','420Bet'),node('div','es-subtitle','EMERALD HARVEST'),node('div','es-ways','✦ 1024 WAYS TO WIN ✦'));root.append(hdr);
  const cabinet=node('div','es-cabinet'),inner=node('div','es-inner');const stage=node('div','es-art-stage');
  const grid=node('div','es-reels');grid.setAttribute('role','img');grid.setAttribute('aria-label','Five reels, four visible rows');
  for(let i=0;i<20;i++){
   const value=shown[i],symbol=value>=0?SLOT_SYMBOLS[value]:'';
   const tile=node('div','es-symbol'+(spinning?' es-spinning':'')+(lastWins.some(w=>w.positions.includes(i))&&!spinning?' es-winning':'')+(value===5?' es-wild':'')+(value===6?' es-scatter':''));tile.dataset.symbol=String(value);
   if(value>=0){const art=node('img','es-symbol-image');art.src=EMERALD_ASSETS.symbols[value];art.alt=symbol;art.draggable=false;tile.append(art);}else{tile.append(node('span','es-symbol-mark','✳'));}if(!spinning&&lastWins.some(w=>w.positions.includes(i))){tile.append(node('span','es-win-spark'));}
   grid.append(tile);
  }
  stage.append(grid);const frameArt=node('img','es-cabinet-art');frameArt.src=EMERALD_ASSETS.cabinet;frameArt.alt='';frameArt.draggable=false;stage.append(frameArt);const banner=node('div','es-feature-banner',featureMessage);banner.setAttribute('aria-live','polite');stage.append(banner);
  if(celebration){const overlay=node('div','es-celebration es-celebration-'+celebration);
   overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');
   const art=node('img','es-celebration-art');
   art.src=celebration==='bigWin'?EMERALD_ASSETS.bigWin:EMERALD_ASSETS.freeSpins;
   art.alt=celebration==='bigWin'?'BIG WIN visual preview':'FREE SPINS feature preview';
   art.draggable=false;overlay.append(art);
   overlay.append(node('span','es-celebration-label',celebration==='bigWin'?'Practice visual celebration · no payout':'Free spins preview · no wager'));
   stage.append(overlay);
  }
  inner.append(stage);cabinet.append(inner);
  const controls=node('div','es-controls'),stats=node('div','es-stats');
  for(const [label,value] of [['WAGER','0'],['PAYOUT','0'],['FREE SPINS',String(freeRemaining)],['PRACTICE BALANCE','—']]){const item=node('div','es-stat');item.append(node('small','',label),node('strong','',value));stats.append(item);}
  const spin=node('button','es-spin',spinning?'SPINNING…':freeRemaining?'FREE SPIN ✦':'✦ SPIN ✦');spin.type='button';spin.disabled=spinning;spin.addEventListener('click',play);controls.append(stats);cabinet.append(controls);stage.append(spin);root.append(cabinet);
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
  celebration=emeraldCelebration(lastWins,triggered);
  draw();
  if(celebration&&view.setTimeout&&!view.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
   overlayTimer=view.setTimeout(()=>{overlayTimer=null;celebration=null;draw();},2600);
  }
 };
 const play=()=>{
  if(spinning)return;
  clearOverlay();
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
