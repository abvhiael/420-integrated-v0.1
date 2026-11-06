import {newGame,spin,SYMBOLS,MAX_WIN_MULTIPLIER} from './dads-secret-stash-engine.js';
import {DSS_SYMBOL_ART,DSS_SYMBOL_LABELS,DSS_CAST_ART,DSS_TRANSITION_ART,DSS_FEATURE_ART,DSS_BACKGROUND_ART} from './dads-secret-stash-assets.js';
const GLYPHS={gary:'😎',jen:'👩',tyler:'🎧',emma:'💜',keller:'📋',bud:'🐕',jar:'🫙',bong:'⚗️',pizza:'🍕',lighter:'🔥',papers:'📜',A:'A',K:'K',Q:'Q',J:'J','10':'10',wild:'🌿',scatter:'☮',stash:'📦',mower:'🚜'};
const FEATURE_TITLES={jen:"OH SHIT, SHE'S HOME!",family:'FAMILY CHAOS!',keller:'HOA INSPECTION!',bud:'GOOD BOY BONUS!',free:'FIVE MINUTES OF PEACE!',stash:"DAD'S SECRET STASH!",mow:'MOW THE LAWN!'};
const FEATURE_PERSON={jen:'JEN',family:'TYLER & EMMA',keller:'MR. KELLER',bud:'BUD',free:'GARY',stash:'GARY',mow:'GARY'};
function el(doc,tag,cls,txt){const x=doc.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x;}
export function createDadsSecretStash(doc=globalThis.document,options={}){
 const rng=options.rng??Math.random,setTimer=options.setTimeout??setTimeout,clearTimer=options.clearTimeout??clearTimeout;
 let state=newGame(),destroyed=false,busy=false,auto=false,autoLeft=0,currentTimer=null,events=[],eventIndex=0,spinTick=0;
 const root=el(doc,'section','dss-game');root.dataset.practiceGame='dads-secret-stash';
 const shell=el(doc,'div','dss-shell'),hero=el(doc,'header','dss-header');
 const logo=el(doc,'img','dss-logo');logo.src='/assets/420bet/dads-secret-stash/title_bar.png';logo.alt="Dad's Secret Stash — Dad reclining with a joint beside the neon-green and orange title";
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
 const larry=el(doc,'img','dss-larry');larry.src='/assets/420bet/dads-secret-stash/characters/gary_main.png';larry.alt='';larry.setAttribute('aria-hidden','true');
 const status=el(doc,'div','dss-status','Practice only — simulated credits, no wallet or wagers');
 const message=el(doc,'p','dss-message',state.message),controls=el(doc,'div','dss-controls');
 const balance=el(doc,'span','dss-stat'),betLabel=el(doc,'span','dss-stat'),winLabel=el(doc,'span','dss-stat'),round=el(doc,'span','dss-stat');
 function btn(txt,fn,cls=''){const b=el(doc,'button','dss-button '+cls,txt);b.type='button';b.addEventListener('click',fn);return b;}
 const lower=btn('− BET',()=>{state.bet=Math.max(1,state.bet-1);refresh();}),higher=btn('+ BET',()=>{state.bet=Math.min(50,state.bet+1);refresh();});
 const play=btn('🌿 SPIN',()=>start(),'dss-spin'),autoBtn=btn('AUTO ×10',()=>{if(auto){auto=false;autoLeft=0;autoBtn.textContent='AUTO ×10';return;}auto=true;autoLeft=10;autoBtn.textContent='STOP AUTO';if(!busy)start();}),info=btn('INFO',()=>{infoPanel.hidden=!infoPanel.hidden;});
 controls.append(balance,lower,betLabel,higher,play,winLabel,round,autoBtn,info);
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
 function showScene(type='main'){scene.dataset.mode=type;scene.style.setProperty('--dss-scene-url',`url("${DSS_BACKGROUND_ART[type]??DSS_BACKGROUND_ART.main}")`);}
 showScene();
 scene.append(larry,reels,overlay);shell.append(hero,scene,status,message,controls,infoPanel);root.append(shell);
 const money=n=>Number(n).toFixed(2);
 function setCell(i,s){
 const cell=cells[i];cell.cell.dataset.symbol=s;cell.cell.title=DSS_SYMBOL_LABELS[s]??s;
 cell.cell.setAttribute('aria-label',DSS_SYMBOL_LABELS[s]??s);
 cell.face.textContent=GLYPHS[s]??s;
 if(cell.image.getAttribute('src')===DSS_SYMBOL_ART[s])return;
 cell.face.hidden=false;cell.image.hidden=true;cell.image.src=DSS_SYMBOL_ART[s]??'';
}
 function showGrid(grid){grid.forEach((s,i)=>setCell(i,s));}
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
    schedule(nextEvent,150);
   }
  };
  schedule(tick,50);
 }
 function refresh(){balance.textContent='BALANCE '+money(state.balance);betLabel.textContent='BET '+money(state.bet);winLabel.textContent='WIN '+money(state.last?.win??0);round.textContent='SPINS '+state.rounds;message.textContent=state.message;lower.disabled=busy;higher.disabled=busy;play.disabled=busy||state.balance<state.bet;autoBtn.disabled=state.balance<state.bet&&!busy;}
 function schedule(fn,ms){currentTimer=setTimer(()=>{currentTimer=null;if(!destroyed)fn();},ms);}
 function finish(){busy=false;overlay.hidden=true;showScene('main');refresh();if(auto&&autoLeft>0&&state.balance>=state.bet){autoLeft--;schedule(start,400);}else{auto=false;autoLeft=0;autoBtn.textContent='AUTO ×10';}}
 function nextEvent(){
 if(destroyed)return;
 if(eventIndex>=events.length){finish();return;}
 const event=events[eventIndex++];
 overlay.hidden=false;bubble.hidden=true;headline.textContent=FEATURE_TITLES[event.type]??event.label;
 showCast(event.type);showScene(['free','stash','mow'].includes(event.type)?event.type:'main');
 overlay.classList.remove('dss-enter');void overlay.offsetWidth;overlay.classList.add('dss-enter');
 // Finish the right-side slide in and main announcement before revealing mystery outcome.
 schedule(()=>{
  bubble.textContent=event.type==='keller'?event.spins+' LOCKED RESPINS':event.type==='bud'?'FETCH WILD!':event.label;
  bubble.hidden=false;status.textContent='BONUS ANNOUNCEMENT: '+(event.label??event.type).toUpperCase();
  // Exactly 500 ms of outcome reveal before the board changes.
  schedule(()=>{
   if(event.grid)showGrid(event.grid);else if(event.boards?.length)showGrid(event.boards.at(-1).grid);
   status.textContent='FEATURE APPLIED: '+(event.label??event.type).toUpperCase()+' — practice result';
   overlay.hidden=true;nextEvent();
  },500);
 },700);
}
 function start(){if(destroyed||busy)return;if(state.balance<state.bet){state.message='Insufficient practice credits — reset to continue.';refresh();return;}busy=true;refresh();status.textContent='SIMULATED SPIN — NO TRANSACTION';state=spin(state,rng);events=state.last.events;eventIndex=0;animateSpin(state.last.grid);}
 const reset=btn('RESET PRACTICE CREDITS',()=>{if(busy)return;state=newGame();showScene('main');showGrid(Array(20).fill('jar'));refresh();});root.append(reset);
 root.stopAnimation=()=>{destroyed=true;auto=false;if(currentTimer!==null)clearTimer(currentTimer);currentTimer=null;reelEls.forEach(reel=>reel.classList.remove('dss-spinning','dss-stopping'));};
 root.getState=()=>state;
 showGrid(Array(20).fill('jar'));refresh();return root;
}
