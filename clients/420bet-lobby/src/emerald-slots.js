import {BASE_REELS,FEATURE_REELS,visibleGrid,chooseStops,awardedFreeSpins,scatterReelCount} from './emerald-v2-strips.js';
import {practiceCreditSnapshot,practiceCreditRoundUnits,resetPracticeCredits} from './practice-credits.js';
import {v2Evaluate,capV2Payout,creditAmount,UNITS,REFERENCE_STAKE,MAX_STAKE,WAY_UNITS,SCATTER_UNITS} from './emerald-v2-payout.js';
import {EMERALD_ASSETS} from './emerald-slots-assets.js';

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
 let spinning=false,freeRemaining=0,lastWins=[],featureMessage='',shown=Array(20).fill(-1),stops=null,timer=null,celebration=null,overlayTimer=null,lastBreakdown=null,lastCreditRound=null,spinFree=false,sessionGrossUnits=0,sessionAwardedUnits=0,sessionStake=REFERENCE_STAKE,selectedStake=REFERENCE_STAKE,autoEnabled=false,autoLeft=0,autoTimer=null,turbo=false,activePanel=null;
 const view=doc.defaultView||{},root=doc.createElement('section');root.className='practice emerald-slots';root.dataset.practiceGame='slots';
 const node=(tag,cls,content)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(content!==undefined)n.textContent=content;return n;};
 const clearOverlay=()=>{if(overlayTimer!==null){view.clearTimeout?.(overlayTimer);overlayTimer=null;}celebration=null;};
 const haltAuto=()=>{autoEnabled=false;autoLeft=0;if(autoTimer!==null){view.clearTimeout?.(autoTimer);autoTimer=null;}};
 const stop=()=>{haltAuto();if(timer!==null){view.clearTimeout?.(timer);timer=null;}clearOverlay();spinning=false;};
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
  for(const [label,value] of [['DEMO STAKE',spinFree?'0 (FREE)':String(selectedStake)],['DEMO WIN',String(lastBreakdown?creditAmount(lastBreakdown.grossUnits):0)],['FREE SPINS',String(freeRemaining)],['PRACTICE CREDITS',String(practiceCreditSnapshot().balance)]]){const item=node('div','es-stat');item.append(node('small','',label),node('strong','',value));stats.append(item);}
  // Real accessible controls adjacent to the canonical cabinet art. The PNG remains unchanged.
  const consoleBar=node('div','es-console');
  const control=(cls,label,handler,disabled=false)=>{const el=node('button','es-console-button '+cls,label);el.type='button';el.disabled=disabled;el.addEventListener('click',handler);return el;};
  const panelButton=(name)=>control('es-panel-button',name.toUpperCase(),()=>{activePanel=activePanel===name?null:name;draw();});
  consoleBar.append(panelButton('info'),panelButton('menu'));
  const betGroup=node('div','es-bet-group');
  betGroup.append(control('es-bet-down','−',()=>{selectedStake=Math.max(1,selectedStake-1);draw();},spinning||freeRemaining>0||autoEnabled||selectedStake===1));
  const betDisplay=node('div','es-bet-display');
  betDisplay.append(node('small','','TOTAL BET'),node('strong','',String(selectedStake)),node('small','','CREDITS'));
  betGroup.append(betDisplay);
  betGroup.append(control('es-bet-up','+',()=>{selectedStake=Math.min(MAX_STAKE,selectedStake+1);draw();},spinning||freeRemaining>0||autoEnabled||selectedStake===MAX_STAKE));
  consoleBar.append(betGroup);
  consoleBar.append(control('es-auto-toggle'+(autoEnabled?' es-control-active':''),autoEnabled?'AUTO ON · '+autoLeft:'AUTO PLAY',()=>{
   if(autoEnabled){haltAuto();draw();return;}
   if(spinning||(!freeRemaining&&practiceCreditSnapshot().balance<selectedStake)){featureMessage='Not enough practice credits for AUTO PLAY.';draw();return;}
   autoEnabled=true;autoLeft=25;activePanel=null;draw();play();
  }));
  consoleBar.append(control('es-turbo-toggle'+(turbo?' es-control-active':''),turbo?'⚡ TURBO ON':'⚡ TURBO',()=>{turbo=!turbo;draw();}));
  controls.append(consoleBar);
  if(activePanel){
   const panel=node('section','es-console-panel');panel.setAttribute('aria-label',activePanel==='info'?'Emerald Harvest paytable':'Emerald Harvest menu');
   panel.append(node('h3','',activePanel==='info'?'EMERALD HARVEST · PAYTABLE':'PRACTICE GAME MENU'));
   if(activePanel==='info'){
    panel.append(node('p','','1,024 ways · awards shown per winning way at a 10-credit wager; every payout scales with TOTAL BET.'));
    const table=node('table','es-paytable');const head=node('tr','');
    for(const label of ['SYMBOL','3 REELS','4 REELS','5 REELS'])head.append(node('th','',label));table.append(head);
    for(let i=0;i<5;i++){
     const tr=node('tr','');tr.append(node('th','',SLOT_SYMBOLS[i]));
     for(const coeff of WAY_UNITS[i])tr.append(node('td','',creditAmount(coeff*REFERENCE_STAKE).toFixed(2)));
     table.append(tr);
    }
    panel.append(table);
    const scatter=node('p','','SCATTER: 3 reels pays '+creditAmount(SCATTER_UNITS[3]*REFERENCE_STAKE)+' credits + 6 free spins; 4 pays '+creditAmount(SCATTER_UNITS[4]*REFERENCE_STAKE)+' + 15; 5 pays '+creditAmount(SCATTER_UNITS[5]*REFERENCE_STAKE)+' + 25.');
    panel.append(scatter,node('p','','One Scatter per base reel. Feature reels replace Scatters with Wilds. FREE SPINS: 4.20× ways payout. WILD substitutes for regular symbols; all-Wild ways pay once at the highest eligible rate.'),node('p','','250× gross cap across the entire paid spin and its free-spin feature. Candidate payout math; independently certified production RTP not yet approved.'));
   }else{
    panel.append(node('p','','INFO displays the paytable. TOTAL BET changes the next paid spin from 1 to 50 credits. During a feature the wager stays fixed.'));
    panel.append(node('p','','AUTO PLAY runs up to 25 paid spins, plays any awarded free spins, stops when cancelled or when practice credits are insufficient. TURBO shortens animations only; odds and awards stay unchanged.'));
    panel.append(control('es-menu-reset','RESET PRACTICE CREDITS',()=>{haltAuto();resetPracticeCredits();lastBreakdown=null;lastCreditRound=null;featureMessage='Practice credits reset.';draw();},spinning||freeRemaining>0));
   }
   controls.append(panel);
  }
  const spin=node('button','es-spin',spinning?'SPINNING…':freeRemaining?'FREE SPIN ✦':'✦ SPIN ✦');spin.type='button';spin.disabled=spinning;spin.addEventListener('click',play);controls.append(stats);cabinet.append(controls);stage.append(spin);root.append(cabinet);
  const details=node('section','es-details');details.append(node('p','es-notice','PRACTICE ONLY · NO WALLET · NO REAL WAGERS · NO CASH-VALUED CREDITS · NO REAL PAYOUTS · No funds involved'));
  const detailsText=spinning?'Reels spinning…':lastWins.length?'Simulated ways: '+lastWins.map(w=>SLOT_SYMBOLS[w.symbol]+' '+w.reels+' reels / '+w.ways+' ways').join(' · '):'No winning ways displayed on this spin.';
  details.append(node('p','es-outcome',detailsText),node('p','es-disclaimer','Visual practice preview using provisional 42-position circular reels. The candidate strip order and demo paytable are not certified production odds or RTP.'));
  const accounting=node('div','es-credit-panel');
  accounting.append(node('h3','','Practice credit breakdown · sample values only'));
  const rows=lastBreakdown?.lines||[];
  if(!rows.length)accounting.append(node('p','','No regular winning ways on the last spin.'));
  for(const w of rows)accounting.append(node('p','es-credit-line',SLOT_SYMBOLS[w.symbol]+' · '+w.reels+' reels · '+w.ways+' ways × '+creditAmount(w.unit*sessionStake)+' = '+creditAmount(w.units)+' credits'));
  if(lastBreakdown?.scatterUnits)accounting.append(node('p','es-credit-line','Scatter on '+lastBreakdown.scatterReels+' reels = '+creditAmount(lastBreakdown.scatterUnits)+' credits'));
  if(lastBreakdown)accounting.append(node('p','es-credit-total','Gross this spin '+creditAmount(lastBreakdown.grossUnits)+' · wager feature aggregate '+creditAmount(sessionGrossUnits)+' · credited after 250× cap '+creditAmount(sessionAwardedUnits)+' · net last spin '+(lastCreditRound?.net??0)));
  const reset=node('button','es-credit-reset','Reset practice credits to 1,000');reset.type='button';reset.disabled=spinning;reset.addEventListener('click',()=>{resetPracticeCredits();lastBreakdown=null;lastCreditRound=null;draw();});accounting.append(reset);
  details.append(accounting);
  details.append(node('p','es-credit-disclosure','V2 candidate unit-scaled practice payouts are NOT an approved production payout schedule or verified RTP. Credits are ephemeral, have zero cash value, cannot be deposited, withdrawn or converted, and never touch a wallet.'));
  root.append(details);
 };
 const finish=()=>{
  shown=visibleGrid(spinFree?FEATURE_REELS:BASE_REELS,stops);spinning=false;
  lastBreakdown=v2Evaluate(shown,sessionStake,{feature:spinFree});
  lastWins=lastBreakdown.lines.map(w=>({symbol:w.symbol,reels:w.reels,ways:w.ways,positions:w.positions}));
  sessionGrossUnits+=lastBreakdown.grossUnits;
  const credited=capV2Payout(sessionGrossUnits,sessionStake,250);
  const increment=credited-sessionAwardedUnits;
  sessionAwardedUnits=credited;
  lastCreditRound=practiceCreditRoundUnits({stakeUnits:spinFree?0:sessionStake*UNITS,payoutUnits:increment});
  const awarded=spinFree?0:awardedFreeSpins(shown);
  const triggered=awarded>0;
  if(triggered){freeRemaining=awarded;featureMessage='✦ FREE SPINS FEATURE ✦ '+freeRemaining+' SPINS · 4.20× MULTIPLIER (PREVIEW)';}
  else if(freeRemaining>0){featureMessage='✦ FREE SPINS ✦ '+freeRemaining+' REMAINING · 4.20× MULTIPLIER (PREVIEW)';}
  else featureMessage=lastWins.length?'✦ MATCHING WAYS ✦':'';
  celebration=triggered?'freeSpins':sessionAwardedUnits>=sessionStake*UNITS*10?'bigWin':null;
  draw();
  if(celebration&&view.setTimeout&&!view.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
   overlayTimer=view.setTimeout(()=>{overlayTimer=null;celebration=null;draw();},turbo?600:2600);
  }
  if(autoEnabled){
   if(freeRemaining>0||autoLeft>0){
    // Autoplay schedules a single subsequent spin; never bypass credit checks.
    autoTimer=view.setTimeout?.(()=>{autoTimer=null;if(autoEnabled)play();},turbo?180:550)??null;
    if(autoTimer===null){haltAuto();draw();}
   }else{haltAuto();draw();}
  }
 };
 const play=()=>{
  if(spinning)return;
  clearOverlay();
  spinFree=freeRemaining>0;
  if(!spinFree&&practiceCreditSnapshot().balance<selectedStake){haltAuto();featureMessage='Not enough practice credits. Reset to continue.';draw();return;}
  if(spinFree)freeRemaining--;else{if(autoEnabled)autoLeft--;sessionStake=selectedStake;sessionGrossUnits=0;sessionAwardedUnits=0;}
  stops=chooseStops();spinning=true;lastWins=[];featureMessage='';
  let tick=0;const steps=turbo?4:12;
  const animate=()=>{if(!spinning)return;tick++;
   const strips=spinFree?FEATURE_REELS:BASE_REELS;
   shown=visibleGrid(strips,stops.map((stop,reel)=>(stop+((steps-tick)*3)+reel)%42));draw();
   if(tick<steps){timer=view.setTimeout?.(animate,turbo?48:95+tick*15)??null;}else{timer=null;finish();}
  };
  if(view.matchMedia?.('(prefers-reduced-motion: reduce)').matches||!view.setTimeout){finish();return;}
  animate();
 };
 draw();return root;
}
