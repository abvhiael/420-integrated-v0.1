import {initialState,nextRound,PAYTABLE,BASE_STRIPS,FREE_STRIPS,HOTBOX_PAYS,visibleBoard} from './sin-city-engine.js';
import {SIN_CITY_BONUS_PREVIEWS,makeSinCityBonusPreview} from './sin-city-bonus-preview.js';
const ROOT='/assets/420bet/sin-city-high-rollers/';
const FILES={
 BUD:'sym_bud.png',JAR:'sym_jar.png',ASH:'sym_ashtray.png',GRINDER:'sym_grinder.png',
 LIGHTER:'sym_lighter.png',PAPERS:'sym_papers.png',BONG:'sym_bong.png',CAR:'sym_lowrider.png',
 CHIPS:'sym_chips.png',MIC:'sym_mic.png',DOLLAR:'sym_dollar_pendant.png',
 '10':'sym_10.png',J:'sym_j.png',Q:'sym_q.png',K:'sym_k.png',A:'sym_a.png',
 BOBBY:'sym_bobby_wild.png',WILD:'sym_wild_leaf.png',SCATTER:'sym_scatter_420.png',GEM:'sym_emerald_gem.png'
};
const art=(category,file)=>ROOT+category+'/'+file;
const el=(doc,tag,cls,text)=>{const e=doc.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
export function createSinCityPractice(doc=globalThis.document,options={}){
 const view=doc.defaultView||globalThis;
 const reduced=!!view.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const root=el(doc,'section','sc-game');root.dataset.practiceGame='sin-city-high-rollers';
 let state=initialState(),panel='',auto=false,autoLeft=0,turbo=false,muted=true,busy=false,dead=false,showBanner='',visualBoard=null,audioContext=null;
 let phase='idle',pending=null,stopped=0,changedCount=0,winIndex=0,highlightCells=[],winPaths=[],spinningMode='base',previousBalance=1000;
 // TEMPORARY QA controls; all demo credits are isolated and the original state is restored.
 let qaSelection='puff',qaPriorState=null,qaForcedStops=null;
 const timers=new Set();
 const playCue=()=>{if(muted||dead)return;try{const Constructor=view.AudioContext||view.webkitAudioContext;if(!Constructor)return;audioContext??=new Constructor();const tone=audioContext.createOscillator(),gain=audioContext.createGain();tone.type='sine';tone.frequency.value=520;gain.gain.value=.025;tone.connect(gain);gain.connect(audioContext.destination);tone.start();tone.stop(audioContext.currentTime+.11);}catch{}};
 const later=(fn,ms)=>{if(dead)return;const id=view.setTimeout?.(()=>{timers.delete(id);if(!dead)fn();},ms);if(id!==undefined)timers.add(id);else fn();};
 const clear=()=>{for(const id of timers)view.clearTimeout?.(id);timers.clear();};
 root.stopAnimation=()=>{dead=true;auto=false;busy=false;clear();void audioContext?.close?.();};
 root.getPresentationState=()=>({phase,stopped,winIndex,winCount:winPaths.length,changedCount,qaActive:qaPriorState!==null,qaSelection,mode:state.mode});
 const button=(label,cls,action)=>{const b=el(doc,'button',cls,label);b.type='button';b.addEventListener('click',action);return b;};
 function showPanel(){
  const scrim=el(doc,'div','sc-modal-backdrop'),modal=el(doc,'section','sc-modal');
  modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label',panel==='info'?'Sin City rules and paytable':'Sin City practice menu');
  const close=button('×','sc-modal-close',()=>{panel='';render();});close.setAttribute('aria-label','Close dialog');modal.append(close,el(doc,'h2','',panel==='info'?'GAME RULES & PAYTABLE':'PRACTICE MENU'));
  if(panel==='info'){
   modal.append(el(doc,'p','','5 reels × 4 rows · 1,024 always-active ways to win. Match three or more identical symbols from left to right; Wild substitutes for paying symbols, not scatters or gems.'));
   const headings=[
    ['PUFF PUFF PASS','Three or more ashtray symbols: one eligible symbol on each affected reel becomes a Wild for this result.'],
    ['HOTBOX RESPINS','Three or more emerald gems activate three respins. Every collected gem remains visible and locked while other symbols spin. New gems reset the counter to three. The collection pays once when the respins finish, with growing rewards from three gems through twenty.'],
    ['CHRONIC SESSIONS','Scatter symbols across 3, 4, or 5 reels trigger 8, 12, or 20 free spins. EVERY Wild that lands stays visible and locked for the remainder of the feature, up to all twenty positions. New qualifying scatters may retrigger five more spins, subject to a 50-spin limit.'],
    ['DROP IT LIKE IT\'S HOT','During free spins, ANY one Lowrider activates a random 2×, 3×, 4×, or 5× multiplier applied to ways wins. Every Wild remains sticky until free spins finish.']
   ];
   for(const [heading,copy] of headings)modal.append(el(doc,'h3','',heading),el(doc,'p','',copy));
   const table=el(doc,'table','sc-paytable');const hr=el(doc,'tr');for(const head of ['SYMBOL','3','4','5'])hr.append(el(doc,'th','',head));table.append(hr);
   for(const [key,values] of Object.entries(PAYTABLE)){const row=el(doc,'tr');row.append(el(doc,'td','',key));for(const value of values)row.append(el(doc,'td','',value.toFixed(2)+'×'));table.append(row);}
   modal.append(table);
   modal.append(el(doc,'h3','','HOTBOX COLLECTION PAYOUTS · MULTIPLIERS OF TOTAL BET'));
   const hotTable=el(doc,'table','sc-paytable sc-hotbox-paytable');
   const header=el(doc,'tr');header.append(el(doc,'th','','GEMS COLLECTED'),el(doc,'th','','TOTAL-BET AWARD'));hotTable.append(header);
   for(let gems=3;gems<=20;gems++){
    const tr=el(doc,'tr');tr.append(el(doc,'td','',String(gems)),el(doc,'td','',HOTBOX_PAYS[gems]+'×'));hotTable.append(tr);
   }
   modal.append(hotTable);
   modal.append(el(doc,'p','sc-note','All awards are candidate practice-credit amounts. 5,000× total wager maximum across a paid spin and its feature. Reel strips and theoretical RTP are not certified.'));
  }else{
   modal.append(el(doc,'p','','All credits are fictional practice units with no cash value. AUTO plays up to 10 paid spins, then pauses when a bonus begins. TURBO changes animation speed only. No wallet, deposits or real-money settlement.'));
   const reset=button('RESET 1,000 PRACTICE CREDITS','sc-reset',()=>{auto=false;autoLeft=0;qaPriorState=null;qaForcedStops=null;state=initialState();panel='';clear();render();});
   reset.disabled=busy||state.mode!=='base';modal.append(reset);
  }
  scrim.append(modal);scrim.addEventListener('click',e=>{if(e.target===scrim){panel='';render();}});
  scrim.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();panel='';render();}});
  root.append(scrim);close.focus();
 }
 function render(){
  if(dead)return;
  root.replaceChildren();
  const scene=el(doc,'div','sc-scene sc-mode-'+(state.mode==='hotbox'?'hotbox':state.mode==='free'?'free':'base'));
  scene.setAttribute('aria-label','Sin City High Rollers interactive slot cabinet');
  const mast=el(doc,'header','sc-masthead');
  const logo=el(doc,'img','sc-logo');logo.src=art('branding','logo_sin_city_high_rollers.png');logo.alt='Sin City High Rollers Cannabis Edition';
  mast.append(logo,el(doc,'span','sc-ways','1,024 WAYS'));scene.append(mast);
  const content=el(doc,'div','sc-machine');
  const mascot=el(doc,'aside','sc-mascot');
  const portrait=el(doc,'img','sc-bobby');portrait.src=art('characters',state.lastFeature==='free-start'||state.lastFeature==='free-retrigger'?'char_bobby_las_vegas_celebration.png':state.lastFeature==='puff'?'char_bobby_las_vegas_smoking.png':'char_bobby_las_vegas_confident.png');portrait.alt='Bobby Las Vegas, fictional casino host';
  const name=el(doc,'div','sc-host-name','BOBBY LAS VEGAS');mascot.append(portrait,name);content.append(mascot);
  const cabinet=el(doc,'div','sc-cabinet');
  const top=el(doc,'div','sc-cabinet-top');
  const modeText=state.mode==='free'?'CHRONIC SESSIONS · '+state.freeRemaining+' FREE SPINS REMAINING':state.mode==='hotbox'?'HOTBOX · '+state.respins+' RESPINS LEFT · '+state.locked.length+' GEMS LOCKED':'PRACTICE PLAY';
  top.append(el(doc,'span','','SIN CITY HIGH ROLLERS'),el(doc,'span','sc-mode-label',modeText));
  cabinet.append(top);
  if(state.mode==='free'||state.mode==='hotbox'||state.lastFeature==='lowrider'||state.lastFeature==='free-start'){
   const hud=el(doc,'div','sc-bonus-hud');
   const heading=state.lastFeature==='lowrider'?'LOWRIDER ×'+state.lastMultiplier+' · ANY CAR MULTIPLIES WAYS WIN':
     state.mode==='hotbox'?'HOTBOX · COLLECT GEMS; 3 RESPINS ON EACH NEW LOCK':
     state.mode==='free'?'CHRONIC SESSIONS · EVERY WILD LOCKS':'BONUS COMPLETE';
   const detail=state.mode==='free'?'SPINS LEFT: '+state.freeRemaining+' · STICKY WILDS: '+state.sticky.length+'/20'+(state.lastRetriggeredSpins?' · +'+state.lastRetriggeredSpins+' RETRIGGERED':''):
      state.mode==='hotbox'?'RESPINS LEFT: '+state.respins+' · LOCKED GEMS: '+state.locked.length+'/20 · FINAL PAY: '+HOTBOX_PAYS[state.locked.length]+'×':
      state.lastFeature==='free-start'?state.lastAwardedSpins+' FREE SPINS AWARDED':'MULTIPLIER APPLIED TO THIS SPIN';
   hud.append(el(doc,'strong','',heading),el(doc,'span','',detail));cabinet.append(hud);
  }
  const reels=el(doc,'div','sc-reels');reels.setAttribute('role','group');reels.setAttribute('aria-label','Five reels with four symbols each');
  for(let r=0;r<5;r++){const rolling=phase==='spinning'&&r>=stopped;
   const col=el(doc,'div','sc-reel'+(rolling?' sc-reel-spinning':'')+(phase==='spinning'&&!rolling?' sc-reel-stopped':''));col.dataset.reel=String(r);for(let row=0;row<4;row++){
   const symbol=(visualBoard||state.lastBoard)[r][row],cell=el(doc,'div','sc-symbol'+(symbol==='WILD'?' sc-wild':'')+(symbol==='GEM'?' sc-gem':'')+(highlightCells.some(([c,y])=>c===r&&y===row)?' sc-changing':''));
   cell.setAttribute('role','img');cell.setAttribute('aria-label','Reel '+(r+1)+' row '+(row+1)+': '+(symbol||'Empty'));
   if(FILES[symbol]){const img=el(doc,'img','');img.src=art('symbols',FILES[symbol]);img.alt='';img.draggable=false;cell.append(img);}
   if((phase==='spinning'?spinningMode:state.mode)==='free'&&state.sticky.includes(r*4+row))cell.classList.add('sc-sticky');
   if((phase==='spinning'?spinningMode:state.mode)==='hotbox'&&state.locked.includes(r*4+row))cell.classList.add('sc-locked');
   col.append(cell);
  }
   if(rolling){
    const window=el(doc,'div','sc-spin-window'),track=el(doc,'div','sc-spin-track');
    const strip=(state.mode==='free'?FREE_STRIPS:BASE_STRIPS)[r];
    const start=((state.lastStops?.[r]??r*7)+10)%strip.length;
    for(let i=0;i<16;i++){
     const tile=el(doc,'div','sc-spin-tile'),symbol=strip[(start+i%8)%strip.length];
     if(FILES[symbol]){const image=el(doc,'img');image.src=art('symbols',FILES[symbol]);image.alt='';image.draggable=false;tile.append(image);}
     track.append(tile);
    }
    window.append(track);col.append(window);
    // Reuse the previous engine state for all anchored cells. Render the gems
    // and Wilds over the scrolling reel strip, not below it or after the stop.
    const held=spinningMode==='hotbox'?state.locked:spinningMode==='free'?state.sticky:[];
    if(held.length){
     const overlay=el(doc,'div','sc-held-overlay');
     overlay.setAttribute('aria-label','Persistent locked positions on spinning reel '+(r+1));
     for(let row=0;row<4;row++){
      const key=r*4+row,heldCell=el(doc,'div','sc-held-cell');
      if(held.includes(key)){
       const symbol=spinningMode==='hotbox'?'GEM':'WILD';
       heldCell.classList.add('sc-held-active',symbol==='GEM'?'sc-held-gem':'sc-held-wild');
       const image=el(doc,'img');image.src=art('symbols',FILES[symbol]);image.alt='';
       image.draggable=false;heldCell.append(image);
       heldCell.setAttribute('aria-label',symbol+' locked in place');
      }
      overlay.append(heldCell);
     }
     col.append(overlay);
    }
   }
   reels.append(col);}
  cabinet.append(reels);
  if(phase==='win'&&winPaths.length){
   const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','sc-win-lines');svg.setAttribute('viewBox','0 0 500 400');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-label','Neon green winning way '+(winIndex+1)+' of '+winPaths.length);
   const path=winPaths[winIndex],points=cells=>cells.map(([r,row])=>(r*100+50)+','+(row*100+50)).join(' ');
   const line=doc.createElementNS('http://www.w3.org/2000/svg','polyline');
   line.setAttribute('points',points(path.matched));line.setAttribute('class','sc-win-polyline');
   line.setAttribute('pathLength','100');svg.append(line);
   if(path.tail.length){
    const tail=doc.createElementNS('http://www.w3.org/2000/svg','polyline');
    tail.setAttribute('points',points([path.matched[path.matched.length-1],...path.tail]));
    tail.setAttribute('class','sc-win-polyline sc-win-continuation');
    tail.setAttribute('pathLength','100');svg.append(tail);
   }
   reels.append(svg);
  }
  const result=el(doc,'div','sc-result',phase==='spinning'?'REELS SPINNING · '+stopped+' OF 5 STOPPED':phase==='announce'?state.lastMessage:phase==='transform'?'BONUS IN ACTION — WATCH THE SYMBOLS CHANGE':phase==='win'?'WINNING WAY '+(winIndex+1)+' OF '+winPaths.length+' · CLICK SCREEN FOR TOTAL':phase==='total'?'TOTAL WIN '+state.lastWin.toFixed(2)+' PRACTICE CREDITS':state.lastMessage);result.setAttribute('role','status');result.setAttribute('aria-live','polite');cabinet.append(result);
  const metrics=el(doc,'div','sc-metrics');
  for(const [caption,value] of [['BALANCE',(['announce','transform','win'].includes(phase)?previousBalance:state.balance).toFixed(2)],['TOTAL BET',state.stake.toFixed(2)],['LAST WIN',['announce','transform','win'].includes(phase)?'—':state.lastWin.toFixed(2)]]){const cell=el(doc,'div','sc-metric');cell.append(el(doc,'small','',caption),el(doc,'strong','',value));metrics.append(cell);}
  cabinet.append(metrics);
  const controls=el(doc,'div','sc-controls');
  const info=button('INFO','sc-control',()=>{panel='info';render();});
  const menu=button('MENU','sc-control',()=>{panel='menu';render();});
  info.disabled=menu.disabled=busy;
  const minus=button('−','sc-control',()=>{state={...state,stake:Math.max(1,state.stake-1)};render();});
  const plus=button('+','sc-control',()=>{state={...state,stake:Math.min(50,state.stake+1)};render();});
  const spin=button(state.mode==='base'?'SPIN':state.mode==='free'?'FREE SPIN':'RESPIN','sc-spin',step);
  spin.disabled=busy||(!auto&&state.mode==='base'&&state.balance<state.stake);
  minus.disabled=plus.disabled=busy||auto||state.mode!=='base'||qaPriorState!==null;
  const autoBtn=button('AUTO '+(auto?'ON':'OFF'),'sc-control'+(auto?' sc-selected':''),()=>{
   auto=!auto;autoLeft=auto?10:0;render();if(auto)later(autoContinue,250);
  });autoBtn.disabled=busy||state.mode!=='base'||qaPriorState!==null;
  const turboBtn=button('TURBO '+(turbo?'ON':'OFF'),'sc-control'+(turbo?' sc-selected':''),()=>{turbo=!turbo;render();});turboBtn.disabled=busy;
  const sound=button(muted?'SOUND OFF':'SOUND ON','sc-control',()=>{muted=!muted;playCue();render();});
  sound.setAttribute('aria-pressed',String(!muted));
  controls.append(info,menu,minus,spin,plus,autoBtn,turboBtn,sound);
  cabinet.append(controls);content.append(cabinet);scene.append(content);
  const footer=el(doc,'p','sc-disclaimer','PRACTICE CREDITS ONLY · NO REAL WAGERS · NO CASH VALUE · PROVISIONAL UNVERIFIED ODDS');scene.append(footer);
  root.append(scene);
  // TEMPORARY QA PANEL: remove this block and its preview helper after feature approval.
  const qa=el(doc,'section','sc-qa-panel');qa.setAttribute('aria-label','Temporary bonus testing controls');
  const qaTitle=el(doc,'strong','','BONUS TESTER · PRACTICE DEMO');
  const qaNote=el(doc,'small','','Runs the real bonus presentation; practice-credit balance is restored when you end the test.');
  const qaChoices=el(doc,'div','sc-qa-choices');qaChoices.setAttribute('role','group');qaChoices.setAttribute('aria-label','Select bonus to test');
  for(const feature of SIN_CITY_BONUS_PREVIEWS){
   const choice=button(feature.label,'sc-qa-choice'+(qaSelection===feature.id?' sc-qa-choice-active':''),()=>{qaSelection=feature.id;render();});
   choice.setAttribute('aria-pressed',String(qaSelection===feature.id));
   choice.disabled=busy||qaPriorState!==null;
   qaChoices.append(choice);
  }
  const qaButton=button('▶ TEST SELECTED BONUS','sc-qa-button',startBonusTest);qaButton.disabled=busy||qaPriorState!==null;
  const endButton=button('■ END BONUS TEST','sc-qa-end',endBonusTest);endButton.disabled=qaPriorState===null;
  qa.append(qaTitle,qaNote,qaChoices,qaButton,endButton);
  if(qaPriorState!==null)qa.append(el(doc,'span','sc-qa-active','TEST MODE · NO REAL CREDIT CHANGES · '+qaSelection.toUpperCase()));
  root.append(qa);
  if(phase==='win'){scene.classList.add('sc-click-to-total');scene.addEventListener('click',event=>{if(event.target.closest?.('button'))return;showTotalWin();});}
  if(showBanner){const overlay=el(doc,'div','sc-feature-overlay');overlay.setAttribute('role','status');const picture=el(doc,'img');picture.src=art('features',showBanner);picture.alt=state.lastMessage;overlay.append(picture);root.append(overlay);}
  if(panel)showPanel();
 }
 function endBonusTest(){
  if(qaPriorState===null)return;
  clear();state=qaPriorState;qaPriorState=null;qaForcedStops=null;
  auto=false;autoLeft=0;busy=false;pending=null;phase='idle';
  visualBoard=null;showBanner='';highlightCells=[];winPaths=[];winIndex=0;stopped=0;render();
 }
 function startBonusTest(){
  if(dead||busy||qaPriorState!==null)return;
  const preview=makeSinCityBonusPreview(qaSelection,state);
  qaPriorState=structuredClone(state);
  qaForcedStops=preview.stops;
  state=preview.state;auto=false;autoLeft=0;panel='';
  step();
 }
 function autoContinue(){
  if(!auto||busy||dead)return;
  if(state.mode!=='base'||autoLeft<=0||state.balance<state.stake){auto=false;autoLeft=0;render();return;}
  autoLeft--;step();
 }

 const bannerFiles={
  puff:'banner_puff_puff_pass.png','hotbox-start':'banner_hotbox_respins.png',hotbox:'banner_hotbox_respins.png',
  'hotbox-end':'banner_hotbox_respins.png','free-start':'banner_chronic_sessions_free_spins.png',
  'free-retrigger':'banner_chronic_sessions_free_spins.png',lowrider:'banner_drop_it_like_its_hot.png'
 };
 function representativePath(board,win){
  const path=[];
  let hasNatural=false;
  for(let r=0;r<win.length;r++){
   const reel=board[r];
   const matches=reel.map((symbol,row)=>({symbol,row})).filter(x=>win.symbol==='WILD'?x.symbol==='WILD':x.symbol===win.symbol||x.symbol==='WILD');
   const chosen=win.symbol==='WILD'?matches[0]:(matches.find(x=>x.symbol===win.symbol)||matches[0]);
   if(!chosen)return [];
   if(chosen.symbol===win.symbol)hasNatural=true;
   path.push([r,chosen.row]);
  }
  if(path.length<3||!(win.symbol==='WILD'||hasNatural))return null;
  // The solid trace follows actual matched reels; a dotted tail projects
  // through remaining reels so the animation always crosses all five columns.
  const tail=[];
  for(let reel=path.length;reel<5;reel++)tail.push([reel,path[path.length-1][1]]);
  return {matched:path,tail};
 }
 function showTotalWin(){
  if(dead||!['win','total'].includes(phase))return;
  phase='total';winPaths=[];highlightCells=[];showBanner='';
  busy=false;render();
  if(auto&&state.mode==='base'&&autoLeft>0)later(autoContinue,turbo?650:1500);
 }
 function presentWins(){
  showBanner='';visualBoard=null;highlightCells=[];
  winPaths=(state.lastWins||[]).map(win=>representativePath(state.lastBoard,win)).filter(Boolean);
  if(!winPaths.length){showTotalWinFromFeature();return;}
  phase='win';winIndex=0;render();
  function next(){
   if(dead||phase!=='win')return;
   winIndex++;
   if(winIndex>=winPaths.length){showTotalWin();return;}
   render();later(next,950);
  }
  later(next,1100);
 }
 function showTotalWinFromFeature(){
  phase='total';busy=false;render();
  if(auto&&state.mode==='base'&&autoLeft>0)later(autoContinue,turbo?650:1500);
 }
 function revealChanges(){
  if(dead)return;
  phase='transform';showBanner='';
  const reveal=state.lastReveal;
  const changes=reveal?.changed||[];
  const before=reveal?.before?.map(reel=>[...reel])||state.lastBoard;
  const after=reveal?.after||state.lastBoard;
  visualBoard=before.map(reel=>[...reel]);changedCount=0;render();
  // Show one reel/cell transformation at a time, including sticky Wild conversion.
  const diff=[];
  for(let r=0;r<5;r++)for(let row=0;row<4;row++){
   if(before[r][row]!==after[r][row])diff.push([r,row]);
  }
  const cells=diff.length?diff:changes.length?changes:[];
  if(!cells.length){
   highlightCells=before.flatMap((reel,r)=>reel.map((symbol,row)=>symbol==='SCATTER'||symbol==='GEM'||symbol==='CAR'?[r,row]:null).filter(Boolean));
   render();later(()=>{highlightCells=[];presentWins();},900);return;
  }
  const advance=index=>{
   if(dead||phase!=='transform')return;
   if(index>=cells.length){highlightCells=[];visualBoard=null;render();later(presentWins,500);return;}
   const [r,row]=cells[index];visualBoard[r][row]=after[r][row];highlightCells=[[r,row]];
   changedCount=index+1;playCue();render();later(()=>advance(index+1),350);
  };
  later(()=>advance(0),350);
 }
 function resolveSpin(){
  if(dead)return;
  state=pending;pending=null;phase='announce';visualBoard=state.lastReveal?.before?.map(reel=>[...reel])||state.lastBoard;
  playCue();
  const reveal=state.lastReveal;
  // Sticky Wild persistence alone never retriggers the Chronic Sessions banner.
  showBanner=bannerFiles[state.lastFeature]||'';
  if(state.mode!=='base'){auto=false;autoLeft=0;}
  render();
  if(showBanner){
   // Never skip the feature announcement; at least one full second is held.
   later(revealChanges,1250);
  }else{
   visualBoard=null;presentWins();
  }
 }
 function stopReel(reel){
  if(dead||phase!=='spinning')return;
  stopped=reel+1;playCue();
  // Only settle the current column; other reel tracks keep spinning uninterrupted.
  const symbols=pending.lastReveal.before[reel];
  const column=root.querySelector('.sc-reel[data-reel="'+reel+'"]');
  if(column){
   column.classList.remove('sc-reel-spinning');
   column.classList.add('sc-reel-stopped');
   column.querySelector('.sc-spin-window')?.remove();
   const cells=[...column.querySelectorAll('.sc-symbol')];
   for(let row=0;row<4;row++){
    const cell=cells[row],symbol=symbols[row];
    cell.setAttribute('aria-label','Reel '+(reel+1)+' row '+(row+1)+': '+symbol);
    cell.replaceChildren();
    if(FILES[symbol]){const img=el(doc,'img');img.src=art('symbols',FILES[symbol]);img.alt='';img.draggable=false;cell.append(img);}
    cell.classList.toggle('sc-wild',symbol==='WILD');
    cell.classList.toggle('sc-gem',symbol==='GEM');
   }
  }
  const status=root.querySelector('.sc-result');
  if(status)status.textContent='REELS SPINNING · '+stopped+' OF 5 STOPPED';
  if(stopped===5)later(resolveSpin,180);
 }
 function step(){
  if(dead||busy)return;
  if(state.mode==='base'&&state.balance<state.stake){auto=false;render();return;}
  clear();showBanner='';winPaths=[];highlightCells=[];stopped=0;changedCount=0;winIndex=0;
  spinningMode=state.mode;previousBalance=state.balance;
  const forced=qaForcedStops??options.pickStops?.(state);
  qaForcedStops=null;
  pending=nextRound(state,options.rng,forced);
  // Feature testing uses a separate simulated state: do not award or consume credits.
  if(qaPriorState!==null)pending.balance=state.balance;
  busy=true;phase='spinning';playCue();
  visualBoard=state.lastBoard.map(reel=>[...reel]);render();
  // Seamless GPU scrolling; no JS frame-by-frame DOM replacement.
  // Every reel after the first stops exactly 750 ms later, Turbo included.
  const first=reduced?150:turbo?400:850;
  for(let r=0;r<5;r++)later(()=>stopReel(r),first+750*r);
 }
 render();return root;
}
