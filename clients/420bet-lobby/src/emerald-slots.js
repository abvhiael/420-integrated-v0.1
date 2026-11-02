import {BASE_REELS,FEATURE_REELS,visibleGrid,chooseStops,awardedFreeSpins,scatterReelCount} from './emerald-v2-strips.js';
import {practiceCreditSnapshot,practiceCreditRound,resetPracticeCredits} from './practice-credits.js';
import {demoSlotBreakdown,DEMO_STAKE} from './emerald-practice-paytable.js';
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
export function slotFeatureEligible(board){return scatterReelCount(board)>=3;}

// Visual-only BIG WIN cue. Not a financial win: practice payouts remain zero.
export function emeraldCelebration(wins,scatterTriggered){
 if(scatterTriggered)return 'freeSpins';
 if(wins.some(w=>w.reels>=5&&w.ways>=4))return 'bigWin';
 return null;
}
export function createEmeraldSlots(doc=globalThis.document){
 let state=initial('slots'),spinning=false,freeRemaining=0,freeAwarded=0,lastWins=[],featureMessage='',shown=Array(20).fill(-1),stops=null,timer=null,celebration=null,overlayTimer=null,lastBreakdown=null,lastCreditRound=null,spinFree=false;
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
  for(const [label,value] of [['DEMO STAKE',spinFree?'0 (FREE)':String(DEMO_STAKE)],['DEMO WIN',String(lastBreakdown?.payout??0)],['FREE SPINS',String(freeRemaining)],['PRACTICE CREDITS',String(practiceCreditSnapshot().balance)]]){const item=node('div','es-stat');item.append(node('small','',label),node('strong','',value));stats.append(item);}
  const spin=node('button','es-spin',spinning?'SPINNING…':freeRemaining?'FREE SPIN ✦':'✦ SPIN ✦');spin.type='button';spin.disabled=spinning;spin.addEventListener('click',play);controls.append(stats);cabinet.append(controls);stage.append(spin);root.append(cabinet);
  const details=node('section','es-details');details.append(node('p','es-notice','PRACTICE ONLY · NO WALLET · NO REAL WAGERS · NO CREDITS · NO PAYOUTS · No funds involved'));
  const detailsText=spinning?'Reels spinning…':lastWins.length?'Simulated ways: '+lastWins.map(w=>SLOT_SYMBOLS[w.symbol]+' '+w.reels+' reels / '+w.ways+' ways').join(' · '):'No winning ways displayed on this spin.';
  details.append(node('p','es-outcome',detailsText),node('p','es-disclaimer','Visual practice preview using provisional 42-position circular reels. The candidate strip order and demo paytable are not certified production odds or RTP.'));
  const accounting=node('div','es-credit-panel');
  accounting.append(node('h3','','Practice credit breakdown · sample values only'));
  const rows=lastBreakdown?.lines||[];
  if(!rows.length)accounting.append(node('p','','No regular winning ways on the last spin.'));
  for(const w of rows)accounting.append(node('p','es-credit-line',SLOT_SYMBOLS[w.symbol]+' · '+w.reels+' reels · '+w.ways+' ways × '+w.unit+' = '+w.credits+' credits'));
  if(lastBreakdown?.scatters)accounting.append(node('p','es-credit-line','Scatter on '+lastBreakdown.scatterReels+' reels = '+lastBreakdown.scatters+' credits'));
  if(lastBreakdown)accounting.append(node('p','es-credit-total','Subtotal '+lastBreakdown.subtotal+' × '+lastBreakdown.multiplier+' = '+lastBreakdown.payout+' demo credits; net '+(lastCreditRound?.net??0)));
  const reset=node('button','es-credit-reset','Reset practice credits to 1,000');reset.type='button';reset.disabled=spinning;reset.addEventListener('click',()=>{resetPracticeCredits();lastBreakdown=null;lastCreditRound=null;draw();});accounting.append(reset);
  details.append(accounting);
  details.append(node('p','es-credit-disclosure','Sample practice credit amounts are NOT an approved production payout schedule or RTP. Credits are ephemeral, have zero cash value, cannot be deposited, withdrawn or converted, and never touch a wallet.'));
  root.append(details);
 };
 const finish=()=>{
  shown=visibleGrid(spinFree?FEATURE_REELS:BASE_REELS,stops);spinning=false;lastWins=slotWays(shown);
  lastBreakdown=demoSlotBreakdown(shown,lastWins,{freeSpin:spinFree});
  lastCreditRound=practiceCreditRound({stake:spinFree?0:DEMO_STAKE,payout:lastBreakdown.payout});
  const awarded=spinFree?0:awardedFreeSpins(shown);
  const triggered=awarded>0;
  if(triggered){freeRemaining=awarded;featureMessage='✦ FREE SPINS FEATURE ✦ '+freeRemaining+' SPINS · 4.20× MULTIPLIER (PREVIEW)';}
  else if(freeRemaining>0){featureMessage='✦ FREE SPINS ✦ '+freeRemaining+' REMAINING · 4.20× MULTIPLIER (PREVIEW)';}
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
  spinFree=freeRemaining>0;
  if(!spinFree&&practiceCreditSnapshot().balance<DEMO_STAKE){featureMessage='Not enough practice credits. Reset to continue.';draw();return;}
  if(spinFree)freeRemaining--;else freeAwarded=0;
  stops=chooseStops();spinning=true;lastWins=[];featureMessage='';
  let tick=0;
  const animate=()=>{if(!spinning)return;tick++;
   const strips=spinFree?FEATURE_REELS:BASE_REELS;
   shown=visibleGrid(strips,stops.map((stop,reel)=>(stop+((12-tick)*3)+reel)%42));draw();
   if(tick<12){timer=view.setTimeout?.(animate,95+tick*15)??null;}else{timer=null;finish();}
  };
  if(view.matchMedia?.('(prefers-reduced-motion: reduce)').matches||!view.setTimeout){finish();return;}
  animate();
 };
 draw();return root;
}
