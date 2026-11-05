import {newGame,spin,choose,SYMBOLS,MAX_WIN_MULTIPLIER} from './dads-secret-stash-engine.js';
const GLYPHS={gary:'😎',jen:'👩',tyler:'🎧',emma:'💜',keller:'📋',bud:'🐕',jar:'🫙',bong:'⚗️',pizza:'🍕',lighter:'🔥',papers:'📜',A:'A',K:'K',Q:'Q',J:'J','10':'10',wild:'🌿',scatter:'☮',stash:'📦',mower:'🚜'};
const FEATURE_TITLES={jen:"OH SHIT, SHE'S HOME!",family:'FAMILY CHAOS!',keller:'HOA INSPECTION!',bud:'GOOD BOY BONUS!',free:'FIVE MINUTES OF PEACE!',stash:"DAD'S SECRET STASH!",mow:'MOW THE LAWN!'};
const FEATURE_PERSON={jen:'JEN',family:'TYLER & EMMA',keller:'MR. KELLER',bud:'BUD',free:'GARY',stash:'GARY',mow:'GARY'};
function el(doc,tag,cls,txt){const x=doc.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x;}
export function createDadsSecretStash(doc=globalThis.document,options={}){
 const rng=options.rng??Math.random,setTimer=options.setTimeout??setTimeout,clearTimer=options.clearTimeout??clearTimeout;
 let state=newGame(),destroyed=false,busy=false,auto=false,autoLeft=0,currentTimer=null,events=[],eventIndex=0;
 const root=el(doc,'section','dss-game');root.dataset.practiceGame='dads-secret-stash';
 const shell=el(doc,'div','dss-shell'),hero=el(doc,'header','dss-header');
 const logo=el(doc,'img','dss-logo');logo.src='/assets/420bet/dads-secret-stash/lobby.svg';logo.alt="Dad's Secret Stash — Gary in his recliner";
 hero.append(logo,el(doc,'p','dss-tag','SUBURBAN SURVIVAL. ONE JOINT AT A TIME.'));
 const scene=el(doc,'div','dss-scene'),reels=el(doc,'div','dss-reels');reels.setAttribute('aria-label','Five reels, four rows');
 const cells=Array.from({length:20},()=>{const cell=el(doc,'div','dss-cell');const face=el(doc,'span','dss-symbol');cell.append(face);reels.append(cell);return {cell,face};});
 const larry=el(doc,'aside','dss-larry');larry.textContent='🧔🏻‍♂️';larry.setAttribute('aria-hidden','true');
 const status=el(doc,'div','dss-status','Practice only — simulated credits, no wallet or wagers');
 const message=el(doc,'p','dss-message',state.message),controls=el(doc,'div','dss-controls');
 const balance=el(doc,'span','dss-stat'),betLabel=el(doc,'span','dss-stat'),winLabel=el(doc,'span','dss-stat'),round=el(doc,'span','dss-stat');
 function btn(txt,fn,cls=''){const b=el(doc,'button','dss-button '+cls,txt);b.type='button';b.addEventListener('click',fn);return b;}
 const lower=btn('− BET',()=>{state.bet=Math.max(1,state.bet-1);refresh();}),higher=btn('+ BET',()=>{state.bet=Math.min(50,state.bet+1);refresh();});
 const play=btn('🌿 SPIN',()=>start(),'dss-spin'),autoBtn=btn('AUTO ×10',()=>{if(auto){auto=false;autoLeft=0;autoBtn.textContent='AUTO ×10';return;}auto=true;autoLeft=10;autoBtn.textContent='STOP AUTO';if(!busy)start();}),info=btn('INFO',()=>{infoPanel.hidden=!infoPanel.hidden;});
 controls.append(balance,lower,betLabel,higher,play,winLabel,round,autoBtn,info);
 const infoPanel=el(doc,'section','dss-info');infoPanel.hidden=true;infoPanel.append(el(doc,'h2','',"How to play — Dad's Secret Stash"),el(doc,'p','', 'Practice-only 5×4 reels, 1,024 ways. Matching paying symbols from the left on 3–5 consecutive reels win. Gary Wild substitutes for paying symbols. Each qualifying cast event independently triggers with 25% probability.'),el(doc,'p','',"3+ Jen: random mystery modifier. Tyler + Emma: random Family Chaos. 3+ Mr. Keller: 2–5 locked-premium respins. 3+ Bud: Fetch Wild. 3+ Scatters: Five Minutes of Peace free spins. 3+ Stash: crate prizes. 3+ Mowers: cascading lawnmower feature. The simulated return is NOT calibrated or certified. Maximum per round: "+MAX_WIN_MULTIPLIER+"× stake."),btn('CLOSE',()=>{infoPanel.hidden=true;}));
 const overlay=el(doc,'div','dss-overlay');overlay.hidden=true;const bubble=el(doc,'div','dss-bubble');const portrait=el(doc,'div','dss-portrait');const headline=el(doc,'h2','dss-announcement');overlay.append(bubble,headline,portrait);
 scene.append(larry,reels,overlay);shell.append(hero,scene,status,message,controls,infoPanel);root.append(shell);
 const money=n=>Number(n).toFixed(2);
 function showGrid(grid){grid.forEach((s,i)=>{cells[i].cell.dataset.symbol=s;cells[i].face.textContent=GLYPHS[s]??s;cells[i].cell.title=s.toUpperCase();});}
 function refresh(){balance.textContent='BALANCE '+money(state.balance);betLabel.textContent='BET '+money(state.bet);winLabel.textContent='WIN '+money(state.last?.win??0);round.textContent='SPINS '+state.rounds;message.textContent=state.message;lower.disabled=busy;higher.disabled=busy;play.disabled=busy||state.balance<state.bet;autoBtn.disabled=state.balance<state.bet&&!busy;}
 function schedule(fn,ms){currentTimer=setTimer(()=>{currentTimer=null;if(!destroyed)fn();},ms);}
 function finish(){busy=false;overlay.hidden=true;refresh();if(auto&&autoLeft>0&&state.balance>=state.bet){autoLeft--;schedule(start,400);}else{auto=false;autoLeft=0;autoBtn.textContent='AUTO ×10';}}
 function nextEvent(){if(destroyed)return;if(eventIndex>=events.length){finish();return;}const event=events[eventIndex++];overlay.hidden=false;headline.textContent=FEATURE_TITLES[event.type]??event.label;portrait.textContent=FEATURE_PERSON[event.type]??'GARY';portrait.dataset.character=event.type;bubble.textContent=event.label??FEATURE_TITLES[event.type];overlay.classList.remove('dss-enter');void overlay.offsetWidth;overlay.classList.add('dss-enter');schedule(()=>{if(event.grid)showGrid(event.grid);else if(event.boards?.length)showGrid(event.boards.at(-1).grid);bubble.textContent=event.type==='keller'?event.spins+' LOCKED RESPINS':event.type==='bud'?'FETCH WILD!':event.label;status.textContent='FEATURE: '+(event.label??event.type).toUpperCase()+' — practice result';schedule(()=>{overlay.hidden=true;nextEvent();},500);},1300);}
 function start(){if(destroyed||busy)return;if(state.balance<state.bet){state.message='Insufficient practice credits — reset to continue.';refresh();return;}busy=true;refresh();status.textContent='SIMULATED SPIN — NO TRANSACTION';state=spin(state,rng);showGrid(state.last.grid);events=state.last.events;eventIndex=0;schedule(nextEvent,420);}
 const reset=btn('RESET PRACTICE CREDITS',()=>{if(busy)return;state=newGame();showGrid(Array(20).fill('jar'));refresh();});root.append(reset);
 root.stopAnimation=()=>{destroyed=true;auto=false;if(currentTimer!==null)clearTimer(currentTimer);currentTimer=null;};
 root.getState=()=>state;
 showGrid(Array(20).fill('jar'));refresh();return root;
}
