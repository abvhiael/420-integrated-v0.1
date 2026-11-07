import {createCannabisCowboyShell,COWBOY_SYMBOLS,cowboySymbolImage} from './cannabis-cowboy-ui.js';
import {BET_CHOICES,CLUSTER_PAYS,weightedSymbol,createPracticeSession,playPracticeRound} from './cannabis-cowboy-engine.js';
import {createRoadTrip,chooseRoadCase,roadStopBackground,roadCaseArtwork} from './cannabis-cowboy-road-trip.js';
import {createReelSequence,drawClusterPaths,clearClusterPaths} from './cannabis-cowboy-reels.js';
const format=n=>Number(n).toLocaleString('en-US');
export function createCannabisCowboyPractice(doc=globalThis.document,options={}){
 const rng=options.rng??Math.random;
 const schedule=options.setTimeout??setTimeout;
 const cancel=options.clearTimeout??clearTimeout;
 let session=createPracticeSession({credits:options.credits??10000,bet:options.bet??20,rng});
 const root=createCannabisCowboyShell(doc);
 root.dataset.mode='base-game-practice';
 const grid=[...root.querySelectorAll('.cc-cell')];
 const consoleBar=root.querySelector('.cc-console');
 const spin=root.querySelector('.cc-spin');
 const minus=root.querySelector('.cc-minus');
 const plus=root.querySelector('.cc-plus');
 const auto=root.querySelector('.cc-auto');
 const menu=root.querySelector('.cc-menu');
 const readouts=[...root.querySelectorAll('.cc-readout')];
 const bet=readouts[0].querySelector('strong');
 const balance=readouts[1].querySelector('strong');
 const win=readouts[2].querySelector('strong');
 const labels=readouts.map(n=>n.querySelector('span'));
 labels[0].textContent='BET · DEMO CREDITS';
 labels[1].textContent='BALANCE · DEMO CREDITS';
 labels[2].textContent='WIN · DEMO CREDITS';
 const paytableBody=root.querySelector('.cc-paytable-table tbody');
 const fmtFactor=x=>Number(x.toFixed(3)).toString();
 CLUSTER_PAYS.forEach((pays,index)=>{
  const tr=doc.createElement('tr');
  const label=doc.createElement('th');label.scope='row';
  const image=cowboySymbolImage(doc,index);label.append(image,doc.createTextNode(COWBOY_SYMBOLS[index].name));tr.append(label);
  pays.forEach(value=>{const td=doc.createElement('td');td.textContent=fmtFactor(value)+'×';tr.append(td);});
  paytableBody.append(tr);
 });
 const payNote=doc.createElement('p');payNote.className='cc-paytable-note';payNote.textContent='Base cluster values shown before Smoke Ring ×2 and Growing Harvest multipliers. Actual demo wins follow engine rounding.';
 root.querySelector('.cc-paytable').append(payNote);
 const info=root.querySelector('.cc-info-panel');
 info.setAttribute('aria-label','High Country Clusters practice rules');
 const infoCopy=info.querySelector('p');
 if(infoCopy)infoCopy.textContent='Practice only: 5 or more adjacent paying symbols form a cluster. Each tumble clears matches and refills the 6×8 board. Endless Harvest frames increase by +1 per winning hit to a maximum ×10 and Smoke Ring Wilds substitute for paying symbols. Landing 3, 4, 5 or 6+ tour bus scatters awards 8, 12, 16 or 20 Endless Harvest free spins. Harvest multipliers and up to 8 sticky wilds persist throughout the feature. Retriggers are capped at 100 total free spins. Demo credits only; no wallet transactions or real wagering. Bonus paytables are not yet RTP certified. On the Road Again: 3 Road Trip tickets on the base spin trigger a five-stop guitar-case pick bonus. Pick one case per stop; one hidden case per stop carries a ×2, ×3, ×5 or ×10 multiplier, the others award credits, and collected multipliers stack at journey end. The six columns spin with staggered stops, and neon lines trace winning clusters. Click the board to skip cluster-count sequences, spin each free game manually, and click the final bonus total to continue.';
 const notice=root.querySelector('.cc-practice-notice');
 notice.textContent='PRACTICE ONLY · ENDLESS HARVEST FREE SPINS ACTIVE · NO REAL WAGERING';
 consoleBar.setAttribute('aria-label','Practice-credit controls');
 root.querySelector('.cc-board-readonly').textContent='BASE-GAME PRACTICE';
 root.querySelector('.cc-board-foot').textContent='5+ ADJACENT · SMOKE RING WILD ×2 · GROWING HARVEST ×2→×32';
 const status=doc.createElement('p');status.className='cc-round-status';status.setAttribute('aria-live','polite');
 status.textContent='Saddle up! Your base-game cluster engine is ready.';
 consoleBar.after(status);
 const setSymbol=(cell,id)=>{
  const sym=COWBOY_SYMBOLS[id];cell.className='cc-cell cc-symbol-'+sym.kind;cell.dataset.symbol=sym.kind;
  cell.replaceChildren();cell.append(cowboySymbolImage(doc,id));
  if(sym.kind==='smoke-wild'){const wild=doc.createElement('span');wild.className='cc-wild-tag';wild.textContent='WILD ×2';cell.append(wild);}
  if(sym.kind==='scatter'){const scatter=doc.createElement('span');scatter.className='cc-scatter-tag';scatter.textContent='SCATTER';cell.append(scatter);}
  if(sym.kind==='road-ticket'){const ticket=doc.createElement('span');ticket.className='cc-scatter-tag';ticket.textContent='ROAD TRIP';cell.append(ticket);}
 };
 const showBoard=(board,highlight=[],fertile=[],phase='idle',upgraded=[],sticky=[])=>{
  clearClusterPaths(root.querySelector('.cc-symbol-grid'));
  const wins=new Set(highlight),grown=new Set(upgraded),pins=new Set(sticky);
  showMultiplierFrames(fertile);
  grid.forEach((cell,i)=>{
   setSymbol(cell,board[i]);cell.classList.toggle('cc-winning',wins.has(i));
   cell.classList.toggle('cc-harvest-upgrade',grown.has(i));
   cell.classList.toggle('cc-sticky-wild',pins.has(i));
   cell.dataset.phase=phase;
   const value=fertile[i]||0;
   if(value){cell.dataset.harvest=String(value);const badge=doc.createElement('span');badge.className='cc-harvest-badge';badge.textContent='×'+value;cell.append(badge);}
   else delete cell.dataset.harvest;
  });
 };
 let busy=false,dead=false,handle=null,queue=[],lastWin=0,timerGeneration=0,activeCascade=null;
 let bonusPreview=false,previewLastWin=0,previewRuns=0;
 let reelSequence=null,pendingRoad=null,roadPicks=[],roadStarted=false;
 let lastWinningClusters=[],lastWinningBoard=null,reviewDismissed=false;
 let pendingFeature=null,featurePhase='none',bonusIndex=0,bonusSpins=[],bonusWin=0,currentSpin=null,finishedBonus=false,displayedSticky=[];
 let displayedFertile=Array(grid.length).fill(0);

 // Harvest multiplier frames are rendered ABOVE reel masks and kept separate
 // from the changing symbols. Their positions remain anchored during spins.
 const multiplierLayer=doc.createElement('div');
 multiplierLayer.className='cc-multiplier-layer';
 multiplierLayer.setAttribute('aria-label','Persistent Growing Harvest multipliers');
 root.querySelector('.cc-symbol-grid').append(multiplierLayer);
 const showMultiplierFrames=values=>{
  const nodes=[];
  values.forEach((value,index)=>{
   if(!value)return;
   const frame=doc.createElement('span');frame.className='cc-multiplier-frame';
   frame.style.gridColumn=String(index%6+1);
   frame.style.gridRow=String(Math.floor(index/6)+1);
   frame.dataset.position=String(index);
   frame.dataset.multiplier=String(value);
   const tag=doc.createElement('span');tag.className='cc-multiplier-value';tag.textContent='×'+value;
   frame.append(tag);nodes.push(frame);
  });
  multiplierLayer.replaceChildren(...nodes);
 };

 const reducedMotion=options.reducedMotion??false;
 const timings=reducedMotion?{start:0,announce:0,burst:0,drop:0}:{start:450,announce:1000,burst:520,drop:580};
 const effects=doc.createElement('div');effects.className='cc-effect-banner';effects.setAttribute('aria-live','polite');effects.hidden=true;
 root.querySelector('.cc-middle').append(effects);
 const bonusCounter=doc.createElement('span');bonusCounter.className='cc-free-counter';bonusCounter.hidden=true;
 root.querySelector('.cc-board-header').append(bonusCounter);
 const featureOverlay=doc.createElement('div');featureOverlay.className='cc-feature-overlay';featureOverlay.hidden=true;featureOverlay.setAttribute('role','status');featureOverlay.setAttribute('aria-live','polite');
 const featureTitle=doc.createElement('strong');featureTitle.className='cc-feature-title';
 const featureMessage=doc.createElement('span');featureMessage.className='cc-feature-message';
 featureOverlay.append(featureTitle,featureMessage);root.querySelector('.cc-middle').append(featureOverlay);
 const roadPanel=doc.createElement('section');roadPanel.className='cc-road-panel';roadPanel.hidden=true;roadPanel.setAttribute('aria-label','On the Road Again guitar case selections');
 root.querySelector('.cc-middle').append(roadPanel);
 const freeSpinButton=doc.createElement('button');freeSpinButton.type='button';freeSpinButton.className='cc-free-spin-button';freeSpinButton.textContent='SPIN FREE GAME';freeSpinButton.hidden=true;
 root.querySelector('.cc-middle').append(freeSpinButton);
 const bonusSplash=doc.createElement('button');bonusSplash.type='button';bonusSplash.className='cc-bonus-total-splash';bonusSplash.hidden=true;
 bonusSplash.setAttribute('aria-label','Endless Harvest complete; click to continue');
 root.querySelector('.cc-middle').append(bonusSplash);
 const reviewPanel=doc.createElement('div');reviewPanel.className='cc-win-review';reviewPanel.hidden=true;reviewPanel.setAttribute('role','status');
 reviewPanel.textContent='NEON WINNING CLUSTERS · CLICK GAME SCREEN TO REVEAL TOTAL WIN';root.querySelector('.cc-middle').append(reviewPanel);
 const showFeature=(title,message)=>{featureTitle.textContent=title;featureMessage.textContent=message;featureOverlay.hidden=false;};
 const hideFeature=()=>{featureOverlay.hidden=true;};
 const phase=(name)=>{featurePhase=name;root.dataset.featurePhase=name;};
 const announce=(message)=>{effects.textContent=message;effects.hidden=false;};
 const hideEffects=()=>{effects.hidden=true;effects.textContent='';};
 const stopReels=()=>{if(reelSequence){reelSequence.abort();reelSequence=null;}};
 const runReels=(board,locked,callback)=>{
  stopReels();status.textContent='REELS SPINNING · SIX COLUMNS';
  reelSequence=createReelSequence({doc,cells:grid,board,locked,schedule:tick,reducedMotion,done:()=>{reelSequence=null;if(!dead)callback();},onStop:col=>{status.textContent='REEL '+(col+1)+' STOPPED / 6';}});
 };
 const bonusSelect=root.querySelector('.cc-bonus-select');
 const bonusButton=root.querySelector('.cc-bonus-preview-button');
 const sync=()=>{
  bet.textContent=format(session.bet);
  balance.textContent=format(session.credits);
  win.textContent=format(lastWin);
  minus.disabled=busy||session.bet===BET_CHOICES[0];
  plus.disabled=busy||session.bet===BET_CHOICES[BET_CHOICES.length-1];
  spin.disabled=busy||session.credits<session.bet;
  spin.textContent='SPIN';
  spin.setAttribute('aria-label',busy?'Spin in progress':'Spin');
  bonusSelect.disabled=busy;bonusButton.disabled=busy;
 };
 const tick=(fn,ms)=>{
  const generation=++timerGeneration;
  handle=schedule(()=>{if(generation!==timerGeneration)return;handle=null;if(!dead)fn();},ms);
 };
 const finish=()=>{
  if(pendingRoad&&!roadStarted){startRoadTrip();return;}
  if(lastWin>0&&!reviewDismissed&&lastWinningBoard&&lastWinningClusters.length){
   phase('win-review');reviewPanel.hidden=false;
   showBoard(lastWinningBoard);
   drawClusterPaths(doc,root.querySelector('.cc-symbol-grid'),lastWinningClusters);
   status.textContent='WINNING CLUSTERS · CLICK GAME SCREEN TO REVEAL TOTAL';
   return;
  }
  busy=false;queue=[];currentSpin=null;pendingFeature=null;bonusSpins=[];hideFeature();hideEffects();stopReels();
  reviewPanel.hidden=true;clearClusterPaths(root.querySelector('.cc-symbol-grid'));roadPanel.hidden=true;
  bonusCounter.hidden=true;phase('none');
  root.querySelector('.cc-board-readonly').textContent='BASE-GAME PRACTICE';
  showBoard(session.board);sync();
  status.textContent=reviewDismissed?'TOTAL WIN · '+format(lastWin)+(bonusPreview?' PREVIEW CREDITS':' DEMO CREDITS'):finishedBonus?'ENDLESS HARVEST COMPLETE · '+format(lastWin)+' total demo credits':lastWin?'HARVEST COMPLETE · '+format(lastWin)+' demo credits won':'No more clusters · Spin again';
  if(bonusPreview){status.textContent+=' · TEST ONLY · BALANCE UNCHANGED';bonusPreview=false;}
 };
 const advance=()=>{
  if(dead)return;
  if(!queue.length){
   if(featurePhase==='bonus-spin'){finishFreeSpin();return;}
   if(pendingFeature){startFreeSpins();return;}
   finish();return;
  }
  const step=queue.shift();activeCascade=step;
  const highlighted=step.clusters.flatMap(x=>x.positions);
  const smokeRings=step.clusters.reduce((count,c)=>count+c.wildCount,0);
  const prior=displayedFertile.slice();
  showBoard(step.before,highlighted,prior,'cluster',[],displayedSticky);
  lastWinningClusters=step.clusters.map(c=>({...c,positions:c.positions.slice()}));
  lastWinningBoard=step.before.slice();
  drawClusterPaths(doc,root.querySelector('.cc-symbol-grid'),step.clusters);
  const mult=step.clusters.map(c=>'×'+c.multiplier).join(' · ');
  status.textContent='CASCADE '+step.index+' · '+step.clusters.length+' clusters · +'+format(step.cascadeWin)+' demo credits';
  announce(smokeRings?'SMOKE RING WILD! ×2  ·  '+mult:'HARVEST! '+mult);
  tick(()=>{
   showBoard(step.before,highlighted,prior,'burst',[],displayedSticky);
   announce('GROWING HARVEST · '+step.removed.length+' CELLS');
   tick(()=>{
    const upgraded=step.fertile.map((x,p)=>x!==prior[p]?p:-1).filter(p=>p>=0);
    displayedFertile=step.fertile.slice();displayedSticky=step.lockedWilds??[];
    showBoard(step.after,[],displayedFertile,'drop',upgraded,displayedSticky);
    announce('MULTIPLIERS GROW · '+upgraded.map(p=>'×'+step.fertile[p]).slice(0,5).join('  '));
    tick(()=>{hideEffects();activeCascade=null;advance();},timings.drop);
   },timings.burst);
  },timings.announce);
 };
 const finishFeature=()=>{
  phase('outro');bonusCounter.hidden=true;hideEffects();hideFeature();freeSpinButton.hidden=true;
  const coins=pendingFeature.total;
  bonusSplash.replaceChildren();
  const title=doc.createElement('strong');title.className='cc-bonus-total-title';title.textContent='ENDLESS HARVEST COMPLETE!';
  const amount=doc.createElement('span');amount.className='cc-bonus-total-amount';amount.textContent=format(coins)+' COINS WON';
  const spins=doc.createElement('span');spins.className='cc-bonus-total-spins';spins.textContent=pendingFeature.played+' FREE SPINS';
  const continuation=doc.createElement('span');continuation.className='cc-bonus-total-continue';continuation.textContent='CLICK TO CONTINUE';
  bonusSplash.append(title,amount,spins,continuation);bonusSplash.hidden=false;
  status.textContent='BONUS COMPLETE · '+format(coins)+' COINS';
  finishedBonus=true;pendingFeature=null;
 };
 const finishFreeSpin=()=>{
  if(!currentSpin)return;
  const spin=currentSpin;
  bonusWin+=spin.outcome.total;
  showBoard(spin.outcome.board,[],spin.outcome.fertile,'idle',[],spin.outcome.lockedWilds);
  hideEffects();
  bonusCounter.textContent='FREE SPIN '+spin.number+' / '+pendingFeature.awarded+' · WON '+format(bonusWin);
  status.textContent='FREE SPIN '+spin.number+' · +'+format(spin.outcome.total)+' · BONUS TOTAL '+format(bonusWin);
  if(spin.retrigger)showFeature('MORE FREE SPINS!','+'+spin.retrigger+' · '+spin.scatters+' SCATTERS');
  else showFeature('FREE SPIN '+spin.number,format(spin.outcome.total)+' DEMO CREDITS');
  tick(()=>{hideFeature();bonusIndex++;if(bonusIndex>=bonusSpins.length)finishFeature();else beginFreeSpin();},reducedMotion?0:spin.retrigger?1450:820);
 };
 const beginFreeSpin=()=>{
  if(dead||!pendingFeature)return;
  currentSpin=bonusSpins[bonusIndex];phase('bonus-ready');
  const spin=currentSpin;
  displayedFertile=spin.initialFertile.slice();displayedSticky=spin.stickyBefore.slice();
  queue=spin.outcome.steps.slice();
  bonusCounter.hidden=false;bonusCounter.textContent='FREE SPIN '+spin.number+' / '+pendingFeature.awarded+' · WON '+format(bonusWin);
  root.querySelector('.cc-board-readonly').textContent='ENDLESS HARVEST';
  showBoard(spin.outcome.startingBoard,[],displayedFertile,'idle',[],displayedSticky);
  status.textContent='FREE SPIN '+spin.number+' OF '+pendingFeature.awarded;
  hideFeature();freeSpinButton.hidden=false;
  freeSpinButton.textContent='SPIN FREE GAME '+spin.number+' / '+pendingFeature.awarded;
  status.textContent='FREE SPIN '+spin.number+' READY · CLICK SPIN FREE GAME';
 };
 const startFreeSpins=()=>{
  if(!pendingFeature)return finish();
  phase('intro');bonusIndex=0;bonusWin=0;
  bonusSpins=pendingFeature.spins.slice();
  hideEffects();
  showFeature('ENDLESS HARVEST!',pendingFeature.initialSpins+' FREE SPINS AWARDED · STICKY WILDS ACTIVE');
  status.textContent='ENDLESS HARVEST · '+pendingFeature.initialSpins+' FREE SPINS';
  tick(()=>{hideFeature();beginFreeSpin();},reducedMotion?0:1800);
 };
 const showRoadStop=()=>{
  if(!pendingRoad||dead)return;
  const index=roadPicks.length,stop=pendingRoad.stops[index];
  roadPanel.replaceChildren();roadPanel.hidden=false;phase('road-trip');
  const sceneArt=doc.createElement('img');sceneArt.className='cc-road-scene';
  sceneArt.src=roadStopBackground(index);sceneArt.alt='';sceneArt.setAttribute('aria-hidden','true');
  sceneArt.addEventListener('error',()=>{sceneArt.hidden=true;});
  roadPanel.append(sceneArt);
  const heading=doc.createElement('h2');heading.className='cc-road-location';
  heading.textContent=stop.scene+'  STOP '+(index+1)+' / 5 · '+stop.name.toUpperCase();
  const description=doc.createElement('p');description.className='cc-road-description';description.textContent=stop.description;
  const subtotal=doc.createElement('p');subtotal.className='cc-road-total';
  const creditSubtotal=roadPicks.reduce((n,p)=>n+p.award,0);
  const stacked=roadPicks.reduce((n,p)=>n*(p.multiplier??1),1);
  subtotal.textContent='COLLECTED '+format(creditSubtotal)+' COINS · STACKED ×'+stacked+' · TOTAL '+format(creditSubtotal*stacked);
  const cases=doc.createElement('div');cases.className='cc-road-cases';
  for(let c=0;c<3;c++){
   const button=doc.createElement('button');button.type='button';button.className='cc-road-case';
   button.setAttribute('aria-label','Pick guitar case '+(c+1));button.dataset.index=String(c);
   const caseArt=doc.createElement('img');caseArt.className='cc-road-case-art';
   caseArt.src=roadCaseArtwork(index,c);caseArt.alt='';caseArt.setAttribute('aria-hidden','true');
   caseArt.addEventListener('error',()=>{caseArt.hidden=true;});
   const caseLabel=doc.createElement('span');caseLabel.className='cc-road-case-caption';caseLabel.textContent='GUITAR CASE '+(c+1);
   button.append(caseArt,caseLabel);
   button.addEventListener('click',()=>{
    if(dead||!pendingRoad||roadPicks.length!==index||button.disabled)return;
    const choice=chooseRoadCase(pendingRoad,roadPicks,c);roadPicks=choice.picks;
    for(const other of [...cases.querySelectorAll('button')]){
     other.disabled=true;
     const otherIndex=Number(other.dataset.index);
      const reveal=doc.createElement('span');reveal.className='cc-road-case-reveal';
      reveal.textContent=otherIndex===stop.multiplierCase?'×'+stop.multiplier+' MULTIPLIER':format(stop.caseValues[otherIndex])+' COINS';
      other.append(reveal);
    }
    button.classList.add('cc-road-chosen');
    const message=doc.createElement('p');message.className='cc-road-award';
    message.textContent=choice.kind==='multiplier'?'CASE '+(c+1)+' REVEALS ×'+choice.multiplier+' · STACKED ×'+choice.stackedMultiplier+' · TOTAL '+format(choice.total):'CASE '+(c+1)+' WINS '+format(choice.award)+' COINS · STACKED ×'+choice.stackedMultiplier+' · TOTAL '+format(choice.total);
    const next=doc.createElement('button');next.type='button';next.className='cc-road-next';
    next.textContent=choice.done?'FINISH THE ROAD TRIP':'NEXT STOP →';
    next.addEventListener('click',()=>{
     if(next.disabled||dead)return;next.disabled=true;
     if(choice.done){
      const grand=choice.total;
      if(!Number.isSafeInteger(session.credits+grand))throw Error('Unsafe Road Trip credits');
      if(!bonusPreview)session={...session,credits:session.credits+grand};
      lastWin+=grand;pendingRoad=null;roadPanel.hidden=true;
      status.textContent='ROAD TRIP COMPLETE · '+format(grand)+' DEMO CREDITS';
      showFeature('ON THE ROAD AGAIN COMPLETE',format(grand)+' COINS · STACKED ×'+choice.stackedMultiplier);
      sync();tick(()=>{hideFeature();finish();},reducedMotion?0:1500);
     }else showRoadStop();
    });
    roadPanel.append(message,next);
   });
   cases.append(button);
  }
  roadPanel.append(heading,description,subtotal,cases);
 };
 const startRoadTrip=()=>{
  if(!pendingRoad||roadStarted)return;
  roadStarted=true;phase('road-trip');
  showFeature('ON THE ROAD AGAIN!','FIVE STOPS · PICK ONE GUITAR CASE AT EACH');
  status.textContent='ROAD TRIP BONUS TRIGGERED · FIVE STOPS';
  tick(()=>{hideFeature();showRoadStop();},reducedMotion?0:1900);
 };
 freeSpinButton.addEventListener('click',event=>{
  event.stopPropagation();
  if(dead||featurePhase!=='bonus-ready'||!currentSpin||!pendingFeature)return;
  freeSpinButton.hidden=true;phase('bonus-spin');
  runReels(currentSpin.outcome.startingBoard,displayedSticky,advance);
 });
 bonusSplash.addEventListener('click',event=>{
  event.stopPropagation();
  if(dead||featurePhase!=='outro')return;
  bonusSplash.hidden=true;reviewDismissed=true;finish();
 });
 root.querySelector('.cc-middle').addEventListener('click',event=>{
  if(dead||event.target.closest?.('.cc-free-spin-button,.cc-bonus-total-splash,.cc-road-panel'))return;
  if(featurePhase==='win-review'&&!reviewDismissed){
   reviewDismissed=true;reviewPanel.hidden=true;
   clearClusterPaths(root.querySelector('.cc-symbol-grid'));
   status.textContent='TOTAL WIN · '+format(lastWin)+' DEMO CREDITS';finish();return;
  }
  if(activeCascade){
   timerGeneration++;if(handle!==null){cancel(handle);handle=null;}
   const finalStep=queue.length?queue[queue.length-1]:activeCascade;
   queue=[];activeCascade=null;hideEffects();reviewDismissed=true;
   displayedFertile=finalStep.fertile.slice();displayedSticky=finalStep.lockedWilds??[];
   showBoard(finalStep.after,[],displayedFertile,'idle',[],displayedSticky);
   if(featurePhase==='bonus-spin')finishFreeSpin();
   else if(pendingFeature)startFreeSpins();
   else finish();
  }
 });
 const play=(testKind=null)=>{
  if(busy||dead||(!testKind&&session.credits<session.bet))return;
  // Bonus testing uses the same authoritative local practice resolver and
  // actual presentation, but neither debits nor credits the session.
  const trial=!!testKind;
  const fixture=Array.from({length:48},(_,i)=>(Math.floor(i/6)*3+i%6)%8);
  if(testKind==='free')for(const p of [0,1,2])fixture[p]=9;
  if(testKind==='road')for(const p of [0,1,2])fixture[p]=10;
  // Varied, reproducible QA previews: each click uses a fresh local seed.
  // Every feature board is weighted randomness with occasional planted adjacent
  // clusters; all awards still come exclusively from the actual cluster engine.
  const previewRun=trial?++previewRuns:0;
  let testSeed=(0xC04207 ^ Math.imul(previewRun,0x9e3779b1))>>>0;
  const testRng=()=>((testSeed=(Math.imul(1664525,testSeed)+1013904223)>>>0)/4294967296);
  const previewFeatureBoard=(spinNo)=>{
   const b=Array.from({length:48},()=>weightedSymbol(testRng));
   const shapes=[[0,1,2,6,12],[0,6,12,13,14],[0,1,6,7,12,13],[0,1,2,3,7],[0,6,7,8,14]];
   const clusterCount=testRng()<.64?2:1;
   for(let cluster=0;cluster<clusterCount;cluster++){
    const pattern=shapes[Math.floor(testRng()*shapes.length)];
    const col=Math.floor(testRng()*3),row=Math.floor(testRng()*5);
    const symbol=Math.floor(testRng()*8);
    for(const offset of pattern)b[(row+Math.floor(offset/6))*6+col+offset%6]=symbol;
   }
   // Test previews allow naturally found incidental wins, never hardcode
   // winnings or override the actual sticky-wild/harvest resolver.
   return b;
  };
  const trialOptions=trial?{
   baseBoard:fixture,
   featureOptions:{boardFactory:previewFeatureBoard}
  }:options.roundOptions??{};
  const activeRng=trial?testRng:rng;
  let result;
  try{result=playPracticeRound(session,activeRng,trialOptions);}
  catch(error){status.textContent='Round could not finish safely; no credits changed';return;}
  if(!result.accepted){status.textContent='Insufficient practice credits';return;}
  // Generate all five Road Trip case offerings before debiting practice credits.
  let road=null;
  try{if(result.outcome.roadTripTriggered)road=createRoadTrip(session.bet,activeRng);}catch(error){status.textContent='Road Trip could not begin safely; no credits changed';return;}
  bonusPreview=trial;
  if(!trial)session=result.state;
  lastWin=result.outcome.total;busy=true;
  pendingRoad=road;roadPicks=[];roadStarted=false;reviewDismissed=false;
  lastWinningClusters=[];lastWinningBoard=null;reviewPanel.hidden=true;roadPanel.hidden=true;
  pendingFeature=result.outcome.feature??null;bonusSpins=[];currentSpin=null;
  finishedBonus=false;bonusIndex=0;bonusWin=0;displayedSticky=[];activeCascade=null;freeSpinButton.hidden=true;bonusSplash.hidden=true;
  phase('base');
  root.querySelector('.cc-board-readonly').textContent='BASE-GAME PRACTICE';
  sync();
  status.textContent='Harvest in progress · '+result.outcome.steps.length+' cascades';
  queue=result.outcome.steps.slice();
  displayedFertile=Array(grid.length).fill(0);displayedSticky=[];
  showBoard(result.outcome.startingBoard);
  runReels(result.outcome.startingBoard,[],advance);
 };
 const betChange=delta=>{
  if(busy||dead)return;
  const i=BET_CHOICES.indexOf(session.bet),next=BET_CHOICES[i+delta];
  if(next!==undefined){session={...session,bet:next};sync();}
 };
 spin.disabled=false;spin.addEventListener('click',()=>play());
 bonusButton.disabled=false;
 bonusButton.addEventListener('click',()=>play(bonusSelect.value==='road'?'road':'free'));
 minus.disabled=false;minus.addEventListener('click',()=>betChange(-1));
 plus.disabled=false;plus.addEventListener('click',()=>betChange(1));
 // Existing menu and auto remain disabled until their M4+ implementation.
 menu.title='Menu options coming in a later milestone';
 auto.title='Autoplay unavailable in this practice build';
 showBoard(session.board);sync();
 root.stopAnimation=()=>{dead=true;busy=false;queue=[];activeCascade=null;timerGeneration++;pendingFeature=null;pendingRoad=null;stopReels();roadPanel.hidden=true;reviewPanel.hidden=true;freeSpinButton.hidden=true;bonusSplash.hidden=true;hideFeature();hideEffects();if(handle!==null){cancel(handle);handle=null;}};
 root.getPracticeState=()=>({credits:session.credits,bet:session.bet,round:session.round,busy,lastWin,featurePhase,bonusIndex,bonusWin,freeSpinCount:bonusSpins.length,bonusSplashVisible:!bonusSplash.hidden,freeSpinReady:featurePhase==='bonus-ready',roadStopsCompleted:roadPicks.length,roadActive:roadStarted&&!!pendingRoad,bonusPreview});
 return root;
}
