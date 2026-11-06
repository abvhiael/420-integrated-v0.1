import {newGame,spin,evaluate,makeBonusPreview,BONUS_PREVIEW_TYPES,SYMBOLS,MAX_WIN_MULTIPLIER} from './dads-secret-stash-engine.js';
import {DSS_SYMBOL_ART,DSS_SYMBOL_LABELS,DSS_CAST_ART,DSS_TRANSITION_ART,DSS_FEATURE_ART,DSS_BACKGROUND_ART,DSS_LARRY_ART} from './dads-secret-stash-assets.js';
const GLYPHS={gary:'😎',jen:'👩',tyler:'🎧',emma:'💜',keller:'📋',bud:'🐕',jar:'🫙',bong:'⚗️',pizza:'🍕',lighter:'🔥',papers:'📜',A:'A',K:'K',Q:'Q',J:'J','10':'10',wild:'🌿',scatter:'☮',stash:'📦',mower:'🚜'};
const FEATURE_TITLES={jen:"OH SHIT, SHE'S HOME!",family:'FAMILY CHAOS!',keller:'HOA INSPECTION!',bud:'GOOD BOY BONUS!',free:'FIVE MINUTES OF PEACE!',stash:"DAD'S SECRET STASH!",mow:'MOW THE LAWN!'};
// Allow the 450ms slide-in to complete, then hold the character for over a full second.
export const DSS_BONUS_PRESENTATION=Object.freeze({characterMs:1600,resultMs:1200});
const FEATURE_PERSON={jen:'JEN',family:'TYLER & EMMA',keller:'MR. KELLER',bud:'BUD',free:'GARY',stash:'GARY',mow:'GARY'};
function el(doc,tag,cls,txt){const x=doc.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x;}
export function createDadsSecretStash(doc=globalThis.document,options={}){
 const rng=options.rng??Math.random,setTimer=options.setTimeout??setTimeout,clearTimer=options.clearTimeout??clearTimeout;
 let state=newGame(),previewPriorState=null,destroyed=false,busy=false,auto=false,autoLeft=0,currentTimer=null,events=[],eventIndex=0,spinTick=0;
 const root=el(doc,'section','dss-game');root.dataset.practiceGame='dads-secret-stash';
 const shell=el(doc,'div','dss-shell'),hero=el(doc,'header','dss-header');
 const logo=el(doc,'img','dss-logo');logo.src='/assets/420bet/dads-secret-stash/dads_secret_stash_title_bar.png';logo.alt="Dad's Secret Stash — Dad reclining with a joint beside the neon-green and orange title";
 const alternative=el(doc,'div','dss-title-composite');
 const dadPortrait=el(doc,'img','dss-title-dad');dadPortrait.src='/assets/420bet/dads-secret-stash/characters/gary_main.png';dadPortrait.alt='';
 const wordmark=el(doc,'div','dss-title-wordmark');
 for(const [word,cls] of [["DAD'S",'dss-word-dad'],['SECRET','dss-word-secret'],['STASH','dss-word-stash']])wordmark.append(el(doc,'span',cls,word));
 alternative.append(dadPortrait,wordmark);alternative.hidden=true;
 logo.addEventListener('error',()=>{logo.hidden=true;alternative.hidden=false;});
 hero.append(logo,alternative,el(doc,'p','dss-tag','SUBURBAN SURVIVAL. ONE JOINT AT A TIME.'));
 const scene=el(doc,'div','dss-scene'),reels=el(doc,'div','dss-reels');reels.setAttribute('aria-label','Five reels, four rows');
 const reelEls=Array.from({length:5},(_,i)=>{const column=el(doc,'div','dss-reel');column.dataset.reel=String(i);reels.append(column);return column;});
 const cells=Array.from({length:20},(_,i)=>{
  const cell=el(doc,'div','dss-cell'),image=el(doc,'img','dss-symbol-image'),face=el(doc,'span','dss-symbol-fallback');
  image.alt='';image.decoding='async';image.draggable=false;
  image.addEventListener('load',()=>{image.hidden=false;face.hidden=true;});
  image.addEventListener('error',()=>{image.hidden=true;face.hidden=false;});
  cell.append(image,face);reelEls[Math.floor(i/4)].append(cell);return {cell,image,face};
 });
 // The slot uses 1,024 ways, not fixed paylines. Trace a representative
 // symbol-matched route and spotlight every contributing symbol.
 const winTrace=el(doc,'div','dss-win-trace');winTrace.hidden=true;
 const winSvg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
 winSvg.setAttribute('class','dss-win-svg');
 winSvg.setAttribute('viewBox','0 0 500 400');
 winSvg.setAttribute('preserveAspectRatio','none');
 winSvg.setAttribute('aria-hidden','true');
 const winWayLabel=el(doc,'div','dss-win-label');
 winTrace.append(winSvg,winWayLabel);
 reels.append(winTrace);
 const larryPanel=el(doc,'aside','dss-larry-panel');
 const larry=el(doc,'img','dss-larry');
 const larryDescriptions=Object.freeze({
  main:'Larry sitting in his garage recliner, enjoying a joint',
  stash:'Larry excitedly pointing toward his secret stash prizes',
  free:'Larry relaxing in his recliner with headphones',
  mow:'Larry mowing the suburban lawn'
 });
 const setLarryMode=(mode='main')=>{
  const next=Object.hasOwn(DSS_LARRY_ART,mode)?mode:'main';
  larryPanel.dataset.mode=next;
  const url=DSS_LARRY_ART[next];
  if(larry.getAttribute('src')!==url)larry.src=url;
  larry.alt=larryDescriptions[next];
 };
 larry.addEventListener('error',()=>{if(larryPanel.dataset.mode!=='main')setLarryMode('main');});
 setLarryMode('main');larry.draggable=false;
 const larryCaption=el(doc,'div','dss-larry-caption','JUST FIVE MORE MINUTES…');
 larryPanel.append(larry,larryCaption);
 const featurePanel=el(doc,'aside','dss-feature-panel');
 const featureHeader=el(doc,'div','dss-feature-header','GARAGE FEATURES');
 const modeTitle=el(doc,'strong','dss-feature-name','DAD’S SECRET STASH');
 const modeDetail=el(doc,'p','dss-feature-detail','Find three stash crates to open the stash!');
 const featureCounter=el(doc,'div','dss-feature-counter','5 REELS · 1,024 WAYS');
 const featureBanner=el(doc,'img','dss-feature-banner');featureBanner.src='/assets/420bet/dads-secret-stash/overlays/hold_and_win.png';featureBanner.alt='Dad’s Secret Stash Hold & Win';
 const featureList=el(doc,'div','dss-feature-list');
 for(const [label,description] of [['SECRET STASH','3 stash crates → Hold & Win'],['FIVE MINUTES OF PEACE','3 scatters → Free Spins'],['MOW THE LAWN','3 lawnmowers → Cascades'],['SURPRISE VISITORS','Jen · Kids · HOA · Bud']]){
  const item=el(doc,'div','dss-feature-item');
  item.append(el(doc,'b','',label),el(doc,'span','',description));featureList.append(item);
 }
 featurePanel.append(featureHeader,featureBanner,modeTitle,modeDetail,featureCounter,featureList);
 const status=el(doc,'div','dss-status','Practice only — simulated credits, no wallet or wagers');
 const message=el(doc,'p','dss-message',state.message),controls=el(doc,'div','dss-controls');
 const balance=el(doc,'span','dss-stat'),betLabel=el(doc,'span','dss-stat'),winLabel=el(doc,'span','dss-stat'),round=el(doc,'span','dss-stat');
 function btn(txt,fn,cls=''){const b=el(doc,'button','dss-button '+cls,txt);b.type='button';b.addEventListener('click',fn);return b;}
 const lower=btn('− BET',()=>{state.bet=Math.max(1,state.bet-1);refresh();}),higher=btn('+ BET',()=>{state.bet=Math.min(50,state.bet+1);refresh();});
 const play=btn('🌿 SPIN',()=>start(),'dss-spin'),autoBtn=btn('AUTO ×10',()=>{if(auto){auto=false;autoLeft=0;autoBtn.textContent='AUTO ×10';return;}auto=true;autoLeft=10;autoBtn.textContent='STOP AUTO';if(!busy)start();}),info=btn('INFO',()=>{infoPanel.hidden=!infoPanel.hidden;});
 controls.append(balance,lower,betLabel,higher,play,winLabel,round,autoBtn,info);
 // TEMPORARY BONUS QA PANEL. This is intentionally practice-only and removable
 // as a single panel/function once bonus presentation qualification is done.
 const previewPanel=el(doc,'section','dss-preview-panel');
 previewPanel.setAttribute('aria-label','Temporary bonus testing controls');
 const previewDescription=el(doc,'span','dss-preview-note','TEST BONUS · PRACTICE DEMO ONLY — no credits awarded');
 const previewSelect=el(doc,'select','dss-preview-select');
 previewSelect.setAttribute('aria-label','Choose bonus to preview');
 const previewNames={
  stash:'SECRET STASH · HOLD & WIN',free:'FIVE MINUTES OF PEACE · FREE SPINS',
  mow:'MOW THE LAWN · CASCADES',jen:"JEN · OH SHIT, SHE'S HOME!",
  family:'FAMILY CHAOS · RANDOM EFFECT', 'family-graffiti':'FAMILY CHAOS · WILD GRAFFITI',
  keller:'HOA INSPECTION · LOCKED RESPINS',bud:'BUD · FETCH WILD'
 };
 for(const type of BONUS_PREVIEW_TYPES){
  const option=el(doc,'option','',previewNames[type]);option.value=type;previewSelect.append(option);
 }
 const previewButton=btn('▶ TEST SELECTED BONUS',()=>startBonusPreview(),'dss-preview-button');
 previewPanel.append(previewDescription,previewSelect,previewButton);
 const infoPanel=el(doc,'section','dss-info');infoPanel.hidden=true;infoPanel.append(el(doc,'h2','',"How to play — Dad's Secret Stash"),el(doc,'p','', 'Practice-only 5×4 reels, 1,024 ways. Matching paying symbols from the left on 3–5 consecutive reels win. Gary Wild substitutes for paying symbols. Each qualifying cast event independently triggers with 25% probability.'),el(doc,'p','',"3+ Jen: random mystery modifier. Tyler + Emma: random Family Chaos. 3+ Mr. Keller: 2–5 locked-premium respins. 3+ Bud: Fetch Wild. 3+ Scatters: Five Minutes of Peace free spins. 3+ Stash: crate prizes. 3+ Mowers: cascading lawnmower feature. The simulated return is NOT calibrated or certified. Maximum per round: "+MAX_WIN_MULTIPLIER+"× stake."),btn('CLOSE',()=>{infoPanel.hidden=true;}));
 const overlay=el(doc,'div','dss-overlay');overlay.hidden=true;
 const backdrop=el(doc,'img','dss-transition-backdrop');backdrop.alt='';backdrop.hidden=true;
 const bubble=el(doc,'div','dss-bubble');bubble.hidden=true;
 const portrait=el(doc,'div','dss-portrait');const nameTag=el(doc,'span','dss-cast-name');
 const titleArt=el(doc,'img','dss-feature-title-art');titleArt.alt='';titleArt.hidden=true;
 const headline=el(doc,'h2','dss-announcement');
 const announcement=el(doc,'div','dss-announcement-stack');announcement.append(titleArt,headline);
 portrait.append(nameTag);overlay.append(backdrop,bubble,announcement,portrait);
 function loadArt(img,url){if(!url){img.hidden=true;return;}img.hidden=false;img.src=url;img.addEventListener('error',()=>{img.hidden=true;},{once:true});}
 function showCast(type){
   for(const old of [...portrait.querySelectorAll('img')])old.remove();
   const art=DSS_CAST_ART[type]??DSS_CAST_ART.stash;
   for(const url of art){const image=el(doc,'img','dss-cast-image');image.src=url;image.alt='';
    image.addEventListener('error',()=>{image.hidden=true;});portrait.insertBefore(image,nameTag);}
   nameTag.textContent=FEATURE_PERSON[type]??'GARY';
   portrait.dataset.character=type;portrait.classList.toggle('dss-cast-pair',art.length>1);
   loadArt(backdrop,DSS_TRANSITION_ART[type]);loadArt(titleArt,DSS_FEATURE_ART[type]);
 }
 function showScene(type='main'){
 const sceneMode=Object.hasOwn(DSS_BACKGROUND_ART,type)?type:'main';
 scene.dataset.mode=sceneMode;shell.dataset.mode=sceneMode;
 setLarryMode(sceneMode);
 shell.style.setProperty('--dss-active-wallpaper',`url("${DSS_BACKGROUND_ART[sceneMode]}")`);
}
 showScene();
 const holdWin=el(doc,'section','dss-hold-win');holdWin.hidden=true;
 holdWin.setAttribute('aria-label','Secret Stash Hold and Win prize board');
 const holdHeading=el(doc,'header','dss-hold-heading','DAD’S SECRET STASH · HOLD & WIN');
 const holdCount=el(doc,'div','dss-hold-count','RESPINS REMAINING: 3');
 const holdTiles=el(doc,'div','dss-hold-tiles');
 const holdCells=Array.from({length:20},()=>{
  const tile=el(doc,'div','dss-hold-cell'),value=el(doc,'span','dss-hold-value');
  tile.append(value);holdTiles.append(tile);return {tile,value};
 });
 const holdTotal=el(doc,'div','dss-hold-total','COLLECTING STASH PRIZES…');
 const bonusHeader=el(doc,'div','dss-bonus-hud');bonusHeader.hidden=true;
 const bonusMode=el(doc,'strong','dss-bonus-mode'),bonusProgress=el(doc,'strong','dss-bonus-progress'),bonusMult=el(doc,'strong','dss-bonus-mult');
 bonusHeader.append(bonusMode,bonusProgress,bonusMult);
 const modifierAction=el(doc,'div','dss-modifier-action');modifierAction.hidden=true;
 const modifierActionTitle=el(doc,'strong','dss-modifier-title');
 const modifierActionDetail=el(doc,'span','dss-modifier-detail');
 modifierAction.append(modifierActionTitle,modifierActionDetail);
 const resultScreen=el(doc,'section','dss-feature-result');resultScreen.hidden=true;
 const resultTitle=el(doc,'h2','dss-feature-result-title'),resultAmount=el(doc,'strong','dss-feature-result-amount'),resultDetail=el(doc,'p','dss-feature-result-detail');
 resultScreen.append(resultTitle,resultAmount,resultDetail);
 holdWin.append(holdHeading,holdCount,holdTiles,holdTotal);
 scene.append(larryPanel,reels,holdWin,featurePanel,bonusHeader,modifierAction,overlay,resultScreen);shell.append(hero,scene,status,message,controls,previewPanel,infoPanel);root.append(shell);
 const money=n=>Number(n).toFixed(2);
 function setCell(i,s){
 const cell=cells[i];cell.cell.dataset.symbol=s;cell.cell.title=DSS_SYMBOL_LABELS[s]??s;
 cell.cell.setAttribute('aria-label',DSS_SYMBOL_LABELS[s]??s);
 cell.face.textContent=GLYPHS[s]??s;
 if(cell.image.getAttribute('src')===DSS_SYMBOL_ART[s])return;
 cell.face.hidden=false;cell.image.hidden=true;cell.image.src=DSS_SYMBOL_ART[s]??'';
}
 function showGrid(grid){grid.forEach((s,i)=>setCell(i,s));}
 function clearWinTrace(){
  winTrace.hidden=true;
  winSvg.replaceChildren();
  winWayLabel.textContent='';
  cells.forEach(({cell})=>cell.classList.remove('dss-paying-symbol'));
 }
 function showWinningWays(grid,winData,done){
  const wins=(winData?.wins??[]).filter(win=>win.amount>0&&win.matched>=3);
  if(!wins.length){clearWinTrace();done();return;}
  let displayed=0;
  const show=()=>{
   if(displayed>=wins.length){
    clearWinTrace();done();return;
   }
   const win=wins[displayed++];
   const indices=[],route=[];
   for(let reel=0;reel<win.matched;reel++){
    const options=[];
    for(let row=0;row<4;row++){
     const i=reel*4+row;
     if(grid[i]===win.symbol||grid[i]==='wild')options.push(i);
    }
    if(!options.length)throw Error('Win display mismatch: '+win.symbol);
    indices.push(...options);
    // The actual win can contain many ways; choose the first displayed route.
    const index=options[0],row=index%4;
    route.push((50+reel*100)+','+(50+row*100));
   }
   winSvg.replaceChildren();
   const addPath=(cls)=>{
    const path=doc.createElementNS('http://www.w3.org/2000/svg','polyline');
    path.setAttribute('class',cls);
    path.setAttribute('points',route.join(' '));
    winSvg.append(path);
   };
   addPath('dss-win-glow');addPath('dss-win-line');
   const hits=new Set(indices);
   cells.forEach(({cell},i)=>cell.classList.toggle('dss-paying-symbol',hits.has(i)));
   winWayLabel.textContent=win.symbol.toUpperCase()+' · '+win.matched+' REELS · '+win.ways+
    (win.ways===1?' WAY':' WAYS')+' · '+money(win.amount*state.last.stake)+' CREDITS';
   winTrace.hidden=false;
   status.textContent='WINNING WAYS: '+winWayLabel.textContent;
   schedule(show,1500);
  };
  show();
 }
 // Visual cycling never uses the outcome RNG or changes the already-resolved result.
 // Each of the five reel columns runs together; reel stops are exactly 500ms apart.
 function animateSpin(finalGrid){
  const stopTicks=[20,30,40,50,60]; // 50ms ticks: 1000, 1500, 2000, 2500, 3000ms
  spinTick=0;
  reelEls.forEach(reel=>{reel.classList.remove('dss-stopping');reel.classList.add('dss-spinning');});
  const tick=()=>{
   if(destroyed)return;
   spinTick++;
   for(let reel=0;reel<5;reel++){
    if(spinTick>stopTicks[reel])continue;
    if(spinTick===stopTicks[reel]){
     for(let row=0;row<4;row++)setCell(reel*4+row,finalGrid[reel*4+row]);
     reelEls[reel].classList.remove('dss-spinning');
     reelEls[reel].classList.add('dss-stopping');
    }else{
     for(let row=0;row<4;row++)setCell(reel*4+row,SYMBOLS[(spinTick*3+reel*7+row*5)%SYMBOLS.length]);
    }
   }
   if(spinTick<stopTicks[4])schedule(tick,50);
   else{
    reelEls.forEach(reel=>reel.classList.remove('dss-stopping'));
    status.textContent='REELS STOPPED — SIMULATED RESULT';
    schedule(()=>showWinningWays(finalGrid,state.last.base,nextEvent),150);
   }
  };
  schedule(tick,50);
 }
 function setFeature(type='main',detail='',counter=''){
 const labels={main:"DAD'S SECRET STASH",free:'FIVE MINUTES OF PEACE',stash:'HOLD & WIN',mow:'MOW THE LAWN',keller:'HOA INSPECTION',jen:"OH SHIT, SHE'S HOME!",family:'FAMILY CHAOS',bud:'GOOD BOY BONUS'};
 modeTitle.textContent=labels[type]??labels.main;
 modeDetail.textContent=detail||'Three matching bonus symbols unlock the garage features.';
 featureCounter.textContent=counter||'5 REELS · 1,024 WAYS';
 const banner=DSS_FEATURE_ART[type]??(type==='main'?DSS_FEATURE_ART.stash:null);
 featureBanner.hidden=!banner;if(banner)featureBanner.src=banner;
 featurePanel.dataset.feature=type;
}
 function refresh(){balance.textContent='BALANCE '+money(state.balance);betLabel.textContent='BET '+money(state.bet);winLabel.textContent='WIN '+money(state.last?.win??0);round.textContent='SPINS '+state.rounds;message.textContent=state.message;lower.disabled=busy;higher.disabled=busy;play.disabled=busy||state.balance<state.bet;autoBtn.disabled=state.balance<state.bet&&!busy;previewSelect.disabled=busy||auto;previewButton.disabled=busy||auto||state.mode!=='practice';}
 function schedule(fn,ms){currentTimer=setTimer(()=>{currentTimer=null;if(!destroyed)fn();},ms);}
 function finish(){busy=false;if(previewPriorState){state=previewPriorState;previewPriorState=null;}clearWinTrace();overlay.hidden=true;modifierAction.hidden=true;resultScreen.hidden=true;bonusHeader.hidden=true;scene.removeAttribute('data-bonus');cells.forEach(({cell})=>cell.classList.remove('dss-sticky','dss-locked','dss-new-lock','dss-clearing','dss-dropping','dss-win-flash','dss-transforming','dss-transformed'));holdWin.hidden=true;reels.hidden=false;showGrid(state.last?.grid??Array(20).fill('jar'));showScene('main');setFeature('main',state.last?.message??'Watch for 3 scatters, stash crates or lawnmowers.','5 REELS · 1,024 WAYS');refresh();status.textContent='Practice only — simulated credits, no wallet or wagers';if(auto&&autoLeft>0&&state.balance>=state.bet){autoLeft--;schedule(start,400);}else{auto=false;autoLeft=0;autoBtn.textContent='AUTO ×10';}}
 function showFeatureResult(event,done){
  const title=FEATURE_TITLES[event.type]??event.label??'FEATURE COMPLETE';
  resultTitle.textContent=title;
  resultAmount.textContent=previewPriorState?'DEMO · '+money(event.units*state.last.stake)+' POTENTIAL CREDITS':money(event.units*state.last.stake)+' PRACTICE CREDITS';
  resultDetail.textContent=event.type==='stash'?event.filled+' STASH PRIZES COLLECTED':
   event.type==='free'?event.spins+' FREE SPINS PLAYED':
   event.type==='keller'?event.spins+' HOA RESPINS COMPLETED':
   event.type==='mow'?event.boards.length+' CASCADES COMPLETED':
   'BONUS MODIFIER APPLIED';
  resultScreen.hidden=false;resultScreen.dataset.feature=event.type;
  status.textContent='FEATURE RESULT — '+title;
  schedule(()=>{resultScreen.hidden=true;done();},2200);
 }
 function showBonusHud(type,progress,extra=''){
  bonusHeader.hidden=false;scene.dataset.bonus=type;
  bonusMode.textContent=FEATURE_TITLES[type]??type.toUpperCase();
  bonusProgress.textContent=progress;
  bonusMult.textContent=extra;
 }
 function animateBonusGrid(entry,type,done){
  const grid=entry.grid;
  if(type==='mow'){
   const removed=entry.removed??[];
   if(entry.before)showGrid(entry.before);
   removed.forEach(i=>cells[i].cell.classList.add('dss-clearing'));
   schedule(()=>{
    showGrid(grid);
    removed.forEach(i=>{cells[i].cell.classList.remove('dss-clearing');cells[i].cell.classList.add('dss-dropping');});
    schedule(()=>{removed.forEach(i=>cells[i].cell.classList.remove('dss-dropping'));done();},500);
   },500);
   return;
  }
  // During free spins and HOA inspection, temporarily cycle only non-locked
  // positions, then snap to the predetermined engine result. Never reroll wins.
  const fixed=new Set(type==='free'?(entry.previous??[]):(entry.locked??[]).filter(i=>!(entry.newLocks??[]).includes(i)));
  let ticks=0;
  const tick=()=>{
   ticks++;
   for(let i=0;i<20;i++)if(!fixed.has(i))setCell(i,SYMBOLS[(ticks*7+i*3)%SYMBOLS.length]);
   if(ticks<6){schedule(tick,85);return;}
   showGrid(grid);
   const highlights=type==='free'?(entry.sticky??[]):(entry.locked??[]);
   cells.forEach(({cell},i)=>{
    cell.classList.toggle('dss-sticky',type==='free'&&highlights.includes(i));
    cell.classList.toggle('dss-locked',type==='keller'&&highlights.includes(i));
    cell.classList.toggle('dss-new-lock',type==='keller'&&(entry.newLocks??[]).includes(i));
    cell.classList.toggle('dss-win-flash',entry.units>0&&(type==='free'?highlights.includes(i):(entry.newLocks??[]).includes(i)));
   });
   schedule(()=>{
    cells.forEach(({cell})=>cell.classList.remove('dss-new-lock','dss-win-flash'));
    done();
   },680);
  };
  tick();
 }
 function playStashBonus(event){
  // A distinct 5x4 feature board, not the base reels and not a summary toast.
  reels.hidden=true;holdWin.hidden=false;showBonusHud('stash','3 RESPINS','LOCK PRIZES');
  const steps=event.steps??[];let index=0;
  const render=(snapshot)=>{
   holdCells.forEach(({tile,value},i)=>{
    const prize=snapshot.board[i],newly=snapshot.newIndices.includes(i);
    tile.classList.toggle('dss-hold-locked',prize!==null);
    tile.classList.toggle('dss-hold-new',newly);
    value.textContent=prize===null?'🌿':prize.toFixed(2)+'×';
   });
   holdCount.textContent='RESPINS REMAINING: '+snapshot.remaining;
   showBonusHud('stash','RESPIN '+snapshot.number,'REMAINING '+snapshot.remaining);
   holdTotal.textContent=snapshot.kind==='start'?'3 STASH PRIZES LOCKED — FIND MORE!':
    snapshot.newIndices.length?'NEW STASH FOUND! RESPINS RESET TO 3':'NO NEW PRIZE — RESPINS COUNT DOWN';
   setFeature('stash','Locked prizes stay on the board as respins continue.',
    'RESPINS '+snapshot.remaining+' · PRIZES '+snapshot.board.filter(v=>v!==null).length+'/20');
   status.textContent='HOLD & WIN · RESPIN '+snapshot.number+' · '+snapshot.remaining+' REMAINING';
  };
  const advance=()=>{
   if(index>=steps.length){
    holdCount.textContent=event.completed?'FULL STASH!':'HOLD & WIN COMPLETE';
    holdTotal.textContent=(previewPriorState?'DEMO TOTAL (NOT AWARDED): ':'TOTAL STASH WIN: ')+money(event.units*state.last.stake)+' PRACTICE CREDITS';
    setFeature('stash',event.filled+' prizes collected','TOTAL '+event.units.toFixed(2)+'× BET');
    status.textContent='SECRET STASH BONUS AWARDED';
    showFeatureResult(event,()=>{holdWin.hidden=true;reels.hidden=false;bonusHeader.hidden=true;nextEvent();});
    return;
   }
   render(steps[index++]);schedule(advance,950);
  };
  advance();
 }
 function animateCastModifier(event){
  // Base reel result must be shown before applying a modifier. The already
  // calculated event.grid and event.units are authoritative; animations do not
  // roll randomness or award chips independently.
  const original=state.last.grid;
  const final=event.grid??original;
  const changed=final.map((symbol,i)=>symbol!==original[i]?i:-1).filter(i=>i>=0);
  showGrid(original);
  modifierAction.hidden=false;
  modifierAction.dataset.type=event.type;
  modifierAction.dataset.outcome=event.label??'';
  modifierActionTitle.textContent=event.label??FEATURE_TITLES[event.type]??'MYSTERY MODIFIER';
  modifierActionDetail.textContent=changed.length?
   changed.length+' REEL SYMBOL'+(changed.length===1?'':'S')+' CHANGING':
   (event.multiplier??1)>1?'×'+event.multiplier+' WIN MULTIPLIER':'REEL EFFECT ACTIVATED';
  setFeature(event.type,'WATCH THE REELS TRANSFORM',modifierActionTitle.textContent);
  showBonusHud(event.type,'MYSTERY MODIFIER',event.label??'');
  // Give the player a clear view of the original grid and what will happen.
  schedule(()=>{
   const reveal=(index)=>{
    if(index>=changed.length){
     showGrid(final);
     const transformed=new Set(changed);
     cells.forEach(({cell},i)=>cell.classList.toggle('dss-transformed',transformed.has(i)));
     modifierActionDetail.textContent=(event.multiplier??1)>1?
      '×'+event.multiplier+' MULTIPLIER APPLIED':
      changed.length+' SYMBOL'+(changed.length===1?'':'S')+' TRANSFORMED';
     status.textContent='FEATURE APPLIED: '+modifierActionTitle.textContent;
     // Show how transformed positions form winning routes before results.
     schedule(()=>showWinningWays(final,evaluate(final),()=>{
      modifierAction.hidden=true;bonusHeader.hidden=true;
      showFeatureResult(event,()=>{
       cells.forEach(({cell})=>cell.classList.remove('dss-transforming','dss-transformed'));
       nextEvent();
      });
     }),1400);
     return;
    }
    const i=changed[index],cell=cells[i].cell;
    cell.classList.add('dss-transforming');
    modifierActionDetail.textContent='TRANSFORMING '+(index+1)+' OF '+changed.length;
    schedule(()=>{
     setCell(i,final[i]);
     cell.classList.remove('dss-transforming');
     cell.classList.add('dss-transformed');
     schedule(()=>reveal(index+1),220);
    },260);
   };
   reveal(0);
  },650);
 }
 function playFeatureSteps(event){
  if(['jen','family','bud'].includes(event.type)){animateCastModifier(event);return;}
  if(event.type==='stash'){playStashBonus(event);return;}
  const boards=event.boards??[];
  if(!boards.length){
   if(event.grid)showGrid(event.grid);
   setFeature(event.type,event.label??'Feature awarded','AWARD '+Number(event.units??0).toFixed(2)+'× BET');
   showFeatureResult(event,nextEvent);return;
  }
  let step=0,accumulated=0;
  const advance=()=>{
   if(step>=boards.length){
    showFeatureResult(event,()=>{
     bonusHeader.hidden=true;cells.forEach(({cell})=>cell.classList.remove('dss-sticky','dss-locked'));
     nextEvent();
    });return;
   }
   const entry=boards[step],which=step+1;
   showBonusHud(event.type,
    event.type==='free'?'FREE SPIN '+which+' OF '+boards.length:
    event.type==='keller'?'INSPECTION RESPIN '+which+' OF '+boards.length:
    'CASCADE '+which+' OF '+boards.length,
    event.type==='free'?'×'+entry.mult+' MULTIPLIER':'');
   const detail=event.type==='free'?'Sticky Wilds remain on the reels':
    event.type==='mow'?'Cut symbols disappear and new symbols tumble down':'Premium symbols lock for remaining respins';
   setFeature(event.type,detail,'SPIN '+which+' / '+boards.length);
   animateBonusGrid(entry,event.type,()=>{
    accumulated+=entry.units;
    status.textContent='FEATURE WIN '+money(entry.units*state.last.stake)+' · TOTAL '+money(accumulated*state.last.stake)+' PRACTICE CREDITS';
    showWinningWays(entry.grid,evaluate(entry.grid),()=>{step++;schedule(advance,500);});
   });
  };
  advance();
 }
 function nextEvent(){
  if(destroyed)return;
  clearWinTrace();
  cells.forEach(x=>x.cell.classList.remove('dss-locked'));
  if(eventIndex>=events.length){finish();return;}
  const event=events[eventIndex++];
  overlay.hidden=false;bubble.hidden=true;headline.textContent=FEATURE_TITLES[event.type]??event.label;
  showCast(event.type);showScene(['free','stash','mow'].includes(event.type)?event.type:'main');
  setFeature(event.type,'BONUS STARTING…',event.label??'');
  overlay.classList.remove('dss-enter');void overlay.offsetWidth;overlay.classList.add('dss-enter');
  schedule(()=>{
   bubble.textContent=event.type==='keller'?event.spins+' LOCKED RESPINS':event.type==='bud'?'FETCH WILD!':event.label;
   bubble.hidden=false;status.textContent='BONUS ANNOUNCEMENT: '+(event.label??event.type).toUpperCase();
   schedule(()=>{
    overlay.hidden=true;
    status.textContent='FEATURE PLAYING: '+(event.label??event.type).toUpperCase();
    playFeatureSteps(event);
   },DSS_BONUS_PRESENTATION.resultMs);
  },DSS_BONUS_PRESENTATION.characterMs);
 }
 function startBonusPreview(){
  if(destroyed||busy||auto||state.mode!=='practice')return;
  const {grid,event}=makeBonusPreview(previewSelect.value,rng);
  clearWinTrace();
  previewPriorState=state;
  // UI needs a stake and a base grid for display; this temporary snapshot
  // never goes through spin() and does not update rounds/history/balance.
  state={...state,last:{grid,base:evaluate(grid),events:[event],stake:state.bet,win:0}};
  events=[event];eventIndex=0;busy=true;
  showGrid(grid);refresh();
  status.textContent='BONUS TEST PREVIEW — NO CREDITS AWARDED';
  nextEvent();
 }
 function start(){if(destroyed||busy||previewPriorState)return;clearWinTrace();if(state.balance<state.bet){state.message='Insufficient practice credits — reset to continue.';refresh();return;}busy=true;refresh();status.textContent='SIMULATED SPIN — NO TRANSACTION';state=spin(state,rng);events=state.last.events;eventIndex=0;setFeature('main','Reels spinning…','GOOD LUCK!');animateSpin(state.last.grid);}
 const reset=btn('RESET PRACTICE CREDITS',()=>{if(busy)return;state=newGame();previewPriorState=null;clearWinTrace();modifierAction.hidden=true;resultScreen.hidden=true;bonusHeader.hidden=true;showScene('main');setFeature('main','Watch for 3 bonus symbols.');showGrid(Array(20).fill('jar'));refresh();});controls.append(reset);
 root.stopAnimation=()=>{destroyed=true;auto=false;if(currentTimer!==null)clearTimer(currentTimer);currentTimer=null;reelEls.forEach(reel=>reel.classList.remove('dss-spinning','dss-stopping'));};
 root.getState=()=>state;
 showGrid(Array(20).fill('jar'));setFeature('main','3 Stash crates unlock Hold & Win.');refresh();return root;
}
