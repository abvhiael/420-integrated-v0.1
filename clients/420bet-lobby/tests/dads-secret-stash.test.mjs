import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {existsSync,readFileSync} from 'node:fs';
import {SLOT_MACHINES,createSlotsLobby,slotMachineFromHash} from '../src/slots-lobby.js';
import {newGame,draw,qualify,triggerCharacters,modifier,inspection,spin,evaluate,stashBonus,freeBonus,mow,makeBonusPreview,BONUS_PREVIEW_TYPES,FREE_WEIGHTS,FREE_STICKY_LIMIT,FREE_MULTIPLIER_STAGES,MOW_PAYOUT_FACTOR} from '../src/dads-secret-stash-engine.js';
import {createDadsSecretStash,DSS_BONUS_PRESENTATION,comicActionCopy} from '../src/dads-secret-stash-ui.js';
import {DSS_SYMBOL_ART,DSS_CAST_ART,DSS_TRANSITION_ART,DSS_BACKGROUND_ART,DSS_FEATURE_ART,DSS_LARRY_ART} from '../src/dads-secret-stash-assets.js';
import {SYMBOLS} from '../src/dads-secret-stash-engine.js';
const board=()=>Array(20).fill('A');const seq=(value)=>()=>value;
test('Slot #3 routes to own page and lobby keeps three cabinets in view',()=>{assert(SLOT_MACHINES.length>=3);assert.equal(SLOT_MACHINES[2].id,'dads-secret-stash');assert.equal(slotMachineFromHash('#game=slots&machine=dads-secret-stash')?.title,"Dad's Secret Stash");const {document}=parseHTML('<html><body></body></html>');const lobby=createSlotsLobby(document);assert.equal(lobby.querySelectorAll('.slots-machine-card').length,SLOT_MACHINES.length);assert.equal([...lobby.querySelectorAll('.slots-machine-card')].filter(x=>!x.hidden).length,3);assert.equal(lobby.querySelectorAll('.slots-carousel-arrow').length,2);});
test('Character conditions require exact thresholds',()=>{const jen=board();jen[0]=jen[1]=jen[2]='jen';assert.equal(qualify(jen).jen,true);jen[2]='A';assert.equal(qualify(jen).jen,false);const family=board();family[3]='tyler';family[4]='emma';assert.equal(qualify(family).family,true);const k=board();k[0]=k[1]=k[2]='keller';assert.equal(qualify(k).keller,true);const bud=board();bud[0]=bud[1]=bud[2]='bud';assert.equal(qualify(bud).bud,true);});
test('25 percent conditional trigger independently applies to every feature',()=>{const grid=board();grid.splice(0,3,'jen','jen','jen');grid.splice(3,3,'keller','keller','keller');grid.splice(6,3,'bud','bud','bud');grid[9]='tyler';grid[10]='emma';assert.deepEqual(triggerCharacters(grid,seq(.249)),{jen:true,family:true,keller:true,bud:true});assert.deepEqual(triggerCharacters(grid,seq(.25)),{jen:false,family:false,keller:false,bud:false});});
test('Jen outcome selectors and fetch wild preserve 5x4 grid',()=>{const grid=board();const jen=modifier(grid,'jen',seq(.3));assert.equal(jen.label,'PANIC WILDS');assert(jen.grid.filter(s=>s==='wild').length>=2);const bud=modifier(grid,'bud',seq(.5));assert.equal(bud.label,'FETCH WILD!');assert(bud.grid.filter(s=>s==='wild').length>=2);});
test('HOA inspection grants five locked-premium respins',()=>{const grid=board();grid[0]='gary';for(const n of [.0,.99]){const out=inspection(grid,seq(n));assert.equal(out.spins,5);assert.equal(out.boards.length,out.spins);assert(out.boards.every(b=>b.grid[0]==='gary'));}});
test('Practice spin debits simulated stake, returns no wallet data, and is capped',()=>{const before=newGame(),after=spin(before,seq(.55));assert.equal(after.rounds,1);assert.equal(before.balance,1000);assert(after.balance>=999);assert(after.last.grid.length===20);assert(after.last.win<=10000*after.bet);assert(!('wallet' in after));assert.equal(evaluate(Array(20).fill('A')).wins.length>0,true);});
test('New game renders controls and supports repeatable disposal',()=>{const {document}=parseHTML('<html><body></body></html>');const game=createDadsSecretStash(document);assert.equal(game.dataset.practiceGame,'dads-secret-stash');assert.equal(game.querySelectorAll('.dss-cell').length,20);assert.match(game.textContent,/SPIN/);assert.equal(typeof game.stopAnimation,'function');game.stopAnimation();});

test('All 20 reel symbols map to approved PNG files and cast art includes the teenage pair',()=>{
 for(const symbol of SYMBOLS) assert.match(DSS_SYMBOL_ART[symbol]??'',/\/assets\/420bet\/dads-secret-stash\/.+\.png$/);
 for(const type of ['jen','family','keller','bud'])assert.match(DSS_TRANSITION_ART[type],/\.png$/);
 assert.equal(DSS_CAST_ART.family.length,2);
 assert.equal(Object.keys(DSS_BACKGROUND_ART).length,4);
 assert.equal(Object.keys(DSS_FEATURE_ART).length,4);
});
test('Game creates image-backed reels and individual PNG character layer for sliding announcement',()=>{
 const {document}=parseHTML('<html><body></body></html>');const game=createDadsSecretStash(document);
 const symbolImages=[...game.querySelectorAll('img.dss-symbol-image')];
 assert.equal(symbolImages.length,20);
 assert.equal(symbolImages[0].getAttribute('src'),DSS_SYMBOL_ART.jar);
 assert(game.querySelector('.dss-portrait'));
 assert(game.querySelector('.dss-transition-backdrop'));
 assert(game.querySelector('.dss-feature-title-art'));
 assert.equal(game.querySelector('.dss-bubble').hidden,true);
 assert.match(game.querySelector('.dss-shell').getAttribute('style'),/garage_main\.png/);
 game.stopAnimation();
});

test('Approved PNG sources exist in the assembled PR and have real PNG signatures',()=>{
 const urls=new Set([
  ...Object.values(DSS_SYMBOL_ART),...Object.values(DSS_BACKGROUND_ART),
  ...Object.values(DSS_TRANSITION_ART),...Object.values(DSS_FEATURE_ART),
  ...Object.values(DSS_CAST_ART).flat()
 ]);
 for(const url of urls){
  const file=new URL('../public'+url,import.meta.url);
  assert(existsSync(file),'Missing approved asset '+url);
  const signature=readFileSync(file).subarray(0,8);
  assert.deepEqual([...signature],[137,80,78,71,13,10,26,10],'Not a PNG: '+url);
 }
 assert(urls.size>=33);
});

test('Reels cycle independently and stop at 1000, 1500, 2000, 2500, 3000 ms in order',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const pending=[];let elapsed=0;let id=0;
 const clock={setTimeout:(fn,ms)=>{const job={id:++id,at:elapsed+ms,fn,cancelled:false};pending.push(job);return job.id;},clearTimeout:(key)=>{const job=pending.find(x=>x.id===key);if(job)job.cancelled=true;}};
 const game=createDadsSecretStash(document,{rng:()=>.55,...clock});
 const reels=[...game.querySelectorAll('.dss-reel')];
 assert.equal(reels.length,5);assert(reels.every(x=>x.querySelectorAll('.dss-cell').length===4));
 const spinButton=[...game.querySelectorAll('button')].find(x=>x.textContent.includes('SPIN'));
 spinButton.dispatchEvent(new window.Event('click',{bubbles:true,cancelable:true}));
 assert(reels.every(x=>x.classList.contains('dss-spinning')));
 assert.notEqual(game.querySelectorAll('.dss-cell')[0].dataset.symbol,game.getState().last.grid[0], 'outcome concealed while reels cycle');
 const advance=target=>{while(true){pending.sort((a,b)=>a.at-b.at);const job=pending.find(x=>!x.cancelled&&x.at<=target);if(!job)break;job.cancelled=true;elapsed=job.at;job.fn();}elapsed=target;};
 for(let i=0;i<5;i++){
  const time=1000+i*500;advance(time-50);
  assert(reels[i].classList.contains('dss-spinning'),'reel '+(i+1)+' still spinning');
  advance(time);
  assert(!reels[i].classList.contains('dss-spinning'),'reel '+(i+1)+' stopped');
  assert(reels.slice(i+1).every(x=>x.classList.contains('dss-spinning')),'later reels still spinning');
  const cells=[...reels[i].querySelectorAll('.dss-cell')];
  assert.deepEqual(cells.map(x=>x.dataset.symbol),game.getState().last.grid.slice(i*4,i*4+4));
 }
 game.stopAnimation();
});

test('Game title loads the approved uploaded PNG rather than the placeholder',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const game=createDadsSecretStash(document);
 const logo=game.querySelector('img.dss-logo');
 assert.equal(logo.getAttribute('src'),'/assets/420bet/dads-secret-stash/dads_secret_stash_title_bar.png');
 const source=new URL('../public'+logo.getAttribute('src'),import.meta.url);
 assert(existsSync(source),'Approved title PNG must exist at the exact rendered URL');
 assert.deepEqual([...readFileSync(source).subarray(0,8)],[137,80,78,71,13,10,26,10]);
 game.stopAnimation();
});

test('Slot #3 uses a panoramic viewport layout with wallpaper behind the logo and four fitted rows',()=>{
 const css=readFileSync(new URL('../src/dads-secret-stash.css',import.meta.url),'utf8');
 const layout=css.slice(css.indexOf('/* Slot #3 panoramic layout:'));
 assert.match(layout,/\.dss-shell\s*\{[^}]*width:100%;height:100%;max-width:none/s);
 assert.match(layout,/\.dss-shell\s*\{[^}]*background-image:/s);
 assert.match(layout,/garage_main\.png/);
 assert.match(layout,/\.dss-scene\s*\{[^}]*flex:1 1 0;min-height:0/s);
 assert.match(layout,/\.dss-reels\s*\{[^}]*height:100%;max-width:100%;max-height:100%/s);
 assert.match(layout,/\.dss-reel\s*\{[^}]*repeat\(4,minmax\(0,1fr\)\)/s);
 assert.match(layout,/\.dss-reel \.dss-cell\s*\{[^}]*min-height:0/s);
 const {document}=parseHTML('<html><body></body></html>');
 const game=createDadsSecretStash(document);
 assert.equal(game.querySelectorAll('.dss-reel').length,5);
 assert.equal(game.querySelectorAll('.dss-cell').length,20);
 assert(game.querySelector('.dss-controls button')?.textContent);
 assert([...game.querySelectorAll('.dss-controls button')].some(x=>x.textContent==='RESET PRACTICE CREDITS'));
 assert.equal([...game.children].filter(x=>x.tagName==='BUTTON').length,0,'No detached reset control');
 game.stopAnimation();
});

test('Concept-accurate composition has prominent Larry, reel symbol breathing room and visible feature rail',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const game=createDadsSecretStash(document);
 const scene=game.querySelector('.dss-scene');
 assert(scene.querySelector('.dss-larry-panel img.dss-larry'));
 assert.equal(scene.querySelectorAll('.dss-reel').length,5);
 assert.equal(scene.querySelectorAll('.dss-cell').length,20);
 assert(scene.querySelector('.dss-feature-panel'));
 assert.match(scene.querySelector('.dss-feature-panel').textContent,/GARAGE FEATURES/);
 assert.match(scene.querySelector('.dss-feature-panel').textContent,/Hold & Win/i);
 assert.match(scene.querySelector('.dss-feature-panel').textContent,/Free Spins/);
 assert.match(scene.querySelector('.dss-feature-panel').textContent,/Cascades/);
 const css=readFileSync(new URL('../src/dads-secret-stash.css',import.meta.url),'utf8');
 const visual=css.slice(css.indexOf('/* Approved four-panel reference:'));
 assert.match(visual,/grid-template-columns:minmax\(175px,23fr\) minmax\(0,57fr\) minmax\(165px,20fr\)/);
 assert.match(visual,/\.dss-larry\s*\{[^}]*width:100%;height:calc\(100% - 33px\)/s);
 assert.match(visual,/\.dss-symbol-image\s*\{[^}]*width:70%;height:70%/s);
 assert.match(visual,/\.dss-feature-panel\s*\{/);
 game.stopAnimation();
});

test('Larry has four valid canonical sprite images and the base game renders the seated sprite',()=>{
 assert.deepEqual(Object.keys(DSS_LARRY_ART),['main','stash','free','mow']);
 for(const [mode,url] of Object.entries(DSS_LARRY_ART)){
  const file=new URL('../public'+url,import.meta.url);
  assert(existsSync(file),'Missing Larry '+mode+' sprite at '+url);
  assert.deepEqual([...readFileSync(file).subarray(0,8)],[137,80,78,71,13,10,26,10],'Invalid Larry PNG: '+mode);
 }
 const {document}=parseHTML('<html><body></body></html>');
 const game=createDadsSecretStash(document);
 assert.equal(game.querySelector('.dss-larry').getAttribute('src'),DSS_LARRY_ART.main);
 assert.equal(game.querySelector('.dss-larry-panel').dataset.mode,'main');
 const source=readFileSync(new URL('../src/dads-secret-stash-ui.js',import.meta.url),'utf8');
 assert.match(source,/setLarryMode\(sceneMode\)/,'Background changes must also change Larry sprite');
 assert.match(source,/showScene\(\['free','stash','mow'\]/,'Feature announcements must switch backgrounds');
 game.stopAnimation();
});

test('Larry uses enlarged foreground art anchored to the recliner, with a ground-level lawnmower variant',()=>{
 const css=readFileSync(new URL('../src/dads-secret-stash.css',import.meta.url),'utf8');
 const sizing=css.slice(css.indexOf("/* Larry's full-body art was constrained"));
 assert(sizing.includes('.dss-larry-panel .dss-larry'));
 assert.match(sizing,/width:148%;\s*height:148%/);
 assert.match(sizing,/bottom:-26%/);
 assert.match(sizing,/data-mode="mow"/);
 assert.match(sizing,/bottom:-8%/);
 assert.match(sizing,/max-width:none/);
 const {document}=parseHTML('<html><body></body></html>');
 const game=createDadsSecretStash(document);
 assert(game.querySelector('.dss-larry-panel img.dss-larry'));
 game.stopAnimation();
});

test('Supporting cast stays visible through slide-in and full-second result announcement',()=>{
 assert(DSS_BONUS_PRESENTATION.characterMs>=1450,'450ms slide plus at least 1000ms settled character');
 assert(DSS_BONUS_PRESENTATION.resultMs>=1000,'Outcome balloon must remain at least one full second');
 const source=readFileSync(new URL('../src/dads-secret-stash-ui.js',import.meta.url),'utf8');
 assert.match(source,/DSS_BONUS_PRESENTATION\.characterMs\);/);
 assert.match(source,/DSS_BONUS_PRESENTATION\.resultMs\);/);
});

test('Regular-play Larry uses a chair-height crop anchored at his face rather than full-body fit',()=>{
 const css=readFileSync(new URL('../src/dads-secret-stash.css',import.meta.url),'utf8');
 const block=css.slice(css.lastIndexOf('/* Regular-play Larry:'),css.indexOf('/* Real Secret Stash feature board:'));
 assert.match(block,/data-mode="main"/);
 assert.match(block,/width:200%;\s*height:145%/);
 assert.match(block,/top:-6%;\s*bottom:auto/);
 assert.match(block,/object-position:50% 0%/);
 assert(!block.includes('[data-mode="free"]'), 'Do not change free-spins sizing without visual evidence');
 assert(!block.includes('[data-mode="stash"]'), 'Do not change stash sizing without visual evidence');
});

test('Secret Stash Hold & Win has 20 locks, three-respin reset and exact awarded prizes',()=>{
 // Constant high RNG: no new prizes on respins, exhausts exactly three turns.
 const empty=stashBonus(()=>.975);
 assert.equal(empty.steps[0].kind,'start');
 assert.equal(empty.steps[0].board.filter(x=>x!==null).length,3);
 assert.equal(empty.steps.length,4);
 assert.deepEqual(empty.steps.slice(1).map(x=>x.remaining),[2,1,0]);
 assert.equal(empty.filled,3);
 assert.equal(empty.units,Math.round(empty.prizes.reduce((a,b)=>a+b,0)*100)/100);
 // Alternating low/high RNG forces a lock on eligible places and resets the timer.
 let n=0;const alternating=stashBonus(()=>[.02,.98,.02,.98,.02,.98][n++%6]);
 assert(alternating.steps.length>=2);
 assert(alternating.steps.length<=41);
 assert(alternating.steps.every(x=>x.board.length===20));
 assert(alternating.steps.every(x=>x.remaining>=0&&x.remaining<=3));
 for(let i=1;i<alternating.steps.length;i++){
  const prev=alternating.steps[i-1].board,now=alternating.steps[i].board;
  prev.forEach((p,k)=>{if(p!==null)assert.equal(now[k],p,'Hold & Win prizes must remain locked');});
  assert.equal(alternating.steps[i].remaining,alternating.steps[i].newIndices.length?3:Math.max(0,alternating.steps[i-1].remaining-1));
 }
 assert.equal(alternating.units,Math.round(alternating.prizes.reduce((a,b)=>a+b,0)*100)/100);
});
test('Secret Stash UI has independent 5x4 bonus board, not a summary-only popup',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const game=createDadsSecretStash(document);
 assert.equal(game.querySelectorAll('.dss-hold-cell').length,20);
 assert(game.querySelector('.dss-hold-count'));
 assert(game.querySelector('.dss-hold-total'));
 assert.equal(game.querySelector('.dss-hold-win').hidden,true);
 const source=readFileSync(new URL('../src/dads-secret-stash-ui.js',import.meta.url),'utf8');
 assert.match(source,/if\(event\.type==='stash'\)\{playStashBonus\(event\);return;\}/);
 assert.match(source,/schedule\(advance,850\)/);
 assert.match(source,/tick===20\+reel\*10/);
 assert(source.includes("showFeatureResult(event,()=>{holdWin.hidden=true;reels.hidden=false;bonusHeader.hidden=true;nextEvent();})"));
 game.stopAnimation();
});

test('Actual 3+ Stash spin enters a playable Hold & Win scene and returns only after award reveal',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');let now=0,id=0;
 const jobs=[];
 const game=createDadsSecretStash(document,{
  rng:()=>.975,
  setTimeout:(fn,ms)=>{const job={id:++id,time:now+ms,fn,cancelled:false};jobs.push(job);return job.id;},
  clearTimeout:key=>{const job=jobs.find(x=>x.id===key);if(job)job.cancelled=true;}
 });
 const advance=until=>{
  let guard=0;
  while(true){
   if(guard++>1500)throw Error('Bonus timeline did not settle');
   jobs.sort((a,b)=>a.time-b.time);
   const next=jobs.find(x=>!x.cancelled&&x.time<=until);
   if(!next)break;
   next.cancelled=true;now=next.time;next.fn();
  }
  now=until;
 };
 const button=[...game.querySelectorAll('button')].find(x=>x.textContent.includes('SPIN'));
 button.dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(game.getState().last.events.length,1);
 assert.equal(game.getState().last.events[0].type,'stash');
 advance(6000);
 const bonus=game.querySelector('.dss-hold-win'),reels=game.querySelector('.dss-reels');
 assert.equal(bonus.hidden,false,'Real bonus board displayed after splash');
 assert.equal(reels.hidden,true,'Base reels must be replaced during Hold & Win');
 assert.equal(bonus.querySelectorAll('.dss-hold-cell').length,20);
 assert.match(game.querySelector('.dss-hold-count').textContent,/RESPINS REMAINING/);
 advance(10000);
 assert.equal(bonus.hidden,false,'Hold and Win remains active while reels stop independently');
 advance(23000);
 assert.equal(bonus.hidden,true,'Bonus scene should exit after all five-column respins and payout reveal');
 assert.equal(reels.hidden,false,'Base reels return after all feature steps');
 assert.equal(game.querySelector('.dss-larry-panel').dataset.mode,'main');
 assert(game.getState().last.win>0);
 game.stopAnimation();
});

test('Free spins expose sticky Wild timeline, multiplier, and win totals for each animated round',()=>{
 const bonus=freeBonus(()=>.976);
 assert.equal(bonus.boards.length,bonus.spins);
 assert(bonus.boards.every(x=>x.grid.length===20&&Array.isArray(x.sticky)&&Array.isArray(x.previous)&&x.mult>=1&&x.mult<=5));
 const held=new Set();
 for(const step of bonus.boards){
  for(const i of held)assert.equal(step.grid[i],'wild');
  for(const i of step.newWilds)held.add(i);
 }
 assert.equal(bonus.units,Math.round(bonus.boards.reduce((s,x)=>s+x.units,0)*100)/100);
});
test('HOA inspection exposes locked positions and newly locked premiums for each respin',()=>{
 const grid=board();grid[0]='gary';
 const bonus=inspection(grid,()=>.8);
 assert.equal(bonus.boards.length,bonus.spins);
 const held=new Set([0]);
 for(const step of bonus.boards){
  assert(step.locked.includes(0));
  assert.equal(step.grid[0],'gary');
  for(const i of step.newLocks)assert(!held.has(i));
  for(const i of step.newLocks)held.add(i);
  assert.deepEqual([...held].sort((a,b)=>a-b),step.locked.slice().sort((a,b)=>a-b));
 }
});
test('Lawn cascades record removed positions and before/after boards for falling symbol effects',()=>{
 const bonus=mow(Array(20).fill('A'),()=>.85);
 assert(bonus.boards.length>=1);
 for(const step of bonus.boards){
  assert.equal(step.grid.length,20);
  assert.equal(step.before.length,20);
  assert(step.removed.length>=3);
  assert(step.removed.every(i=>step.before[i]==='A'||['A','K','Q','J','10','papers','lighter','pizza'].includes(step.before[i])));
  for(let i=0;i<20;i++)if(!step.removed.includes(i))assert.equal(step.grid[i],step.before[i]);
 }
});
test('All bonus modes have animated steps and visible final results; Larry can overlap the title',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const game=createDadsSecretStash(document);
 assert(game.querySelector('.dss-feature-result'));
 assert(game.querySelector('.dss-bonus-hud'));
 const source=readFileSync(new URL('../src/dads-secret-stash-ui.js',import.meta.url),'utf8');
 for(const name of ['showBonusHud','showFeatureResult','animateBonusGrid','dss-clearing','dss-dropping','dss-sticky','dss-new-lock'])
  assert(source.includes(name),'Missing bonus presentation step '+name);
 const css=readFileSync(new URL('../src/dads-secret-stash.css',import.meta.url),'utf8');
 const overlay=css.slice(css.lastIndexOf('/* Preserve Larry'));
 assert(overlay.includes('.dss-larry-panel[data-mode="main"]{overflow:visible!important;z-index:8'));
 assert(overlay.includes('.dss-header{position:relative;z-index:1}'));
 assert(overlay.includes('.dss-scene{position:relative;z-index:3;overflow:visible'));
 assert(overlay.includes('.dss-feature-result'));
 game.stopAnimation();
});

test('Larry remains above the header but behind reel frame and bonus board',()=>{
 const css=readFileSync(new URL('../src/dads-secret-stash.css',import.meta.url),'utf8');
 const layering=css.slice(css.lastIndexOf('/* Cabinet foreground occlusion:'));
 assert.match(layering,/\.dss-header\{z-index:1\}/);
 assert.match(layering,/\.dss-larry-panel\[data-mode="main"\]\{z-index:2;overflow:visible!important\}/);
 assert.match(layering,/\.dss-reels,\.dss-hold-win\{position:relative;z-index:10;isolation:isolate\}/);
 assert.match(layering,/\.dss-overlay\{z-index:20\}/);
 assert.match(layering,/\.dss-feature-result\{z-index:25\}/);
 const {document}=parseHTML('<html><body></body></html>');
 const game=createDadsSecretStash(document);
 assert(game.querySelector('.dss-scene .dss-larry-panel'));
 assert(game.querySelector('.dss-scene .dss-reels'));
 game.stopAnimation();
});

test('Balance bar renders above Larry and reel modifiers get visible transformation phases',()=>{
 const css=readFileSync(new URL('../src/dads-secret-stash.css',import.meta.url),'utf8');
 const stack=css.slice(css.lastIndexOf('/* Larry stays between wallpaper'));
 assert.match(stack,/\.dss-controls,\.dss-status,\.dss-message\{position:relative;z-index:30\}/);
 assert.match(stack,/\.dss-cell\.dss-transforming/);
 assert.match(stack,/\.dss-cell\.dss-transformed/);
 const {document}=parseHTML('<html><body></body></html>');
 const game=createDadsSecretStash(document);
 assert(game.querySelector('.dss-modifier-action'));
 assert.equal(game.querySelector('.dss-modifier-action').hidden,true);
 assert(game.querySelector('.dss-controls .dss-stat'));
 game.stopAnimation();
});
test('Family Chaos Wild Graffiti visibly changes the board before the win popup',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 let now=0,id=0,r=0;const jobs=[];
 const rngValues=[.06,.09,...Array(18).fill(.51),.01,.3,.5,.5,.5,.5];
 const clock={
  rng:()=>rngValues[r++]??.51,
  setTimeout:(fn,ms)=>{const task={id:++id,when:now+ms,fn,done:false};jobs.push(task);return task.id;},
  clearTimeout:key=>{const task=jobs.find(x=>x.id===key);if(task)task.done=true;}
 };
 const advance=target=>{
  let guard=0;
  while(true){
   if(guard++>1500)throw Error('Modifier animation did not settle');
   jobs.sort((a,b)=>a.when-b.when);
   const task=jobs.find(x=>!x.done&&x.when<=target);
   if(!task)break;
   task.done=true;now=task.when;task.fn();
  }
  now=target;
 };
 const game=createDadsSecretStash(document,clock);
 const button=[...game.querySelectorAll('button')].find(x=>x.textContent.includes('SPIN'));
 button.dispatchEvent(new window.Event('click',{bubbles:true}));
 const event=game.getState().last.events[0];
 assert.equal(event.type,'family');
 assert.equal(event.label,'WILD GRAFFITI');
 const initial=game.getState().last.grid;
 const cells=[...game.querySelectorAll('.dss-cell')];
 // Base-game winning ways now play for 1.5s before Family Chaos starts.
 advance(9300);
 assert.equal(game.querySelector('.dss-modifier-action').hidden,false);
 assert.deepEqual(cells.map(x=>x.dataset.symbol),initial,'Original reel symbols visible before graffiti');
 advance(10750);
 assert(cells.some((x,i)=>x.dataset.symbol!==initial[i]),'At least one reel symbol transforms before the result');
 assert.equal(game.querySelector('.dss-feature-result').hidden,true,'Win popup must not obscure transformations');
 advance(13000);
 assert.deepEqual(cells.map(x=>x.dataset.symbol),event.grid,'All changed reel positions should match calculated result');
 let sawTrace=false,sawResult=false;
 for(let time=13100;time<=31500;time+=100){
  advance(time);
  sawTrace ||= !game.querySelector('.dss-win-trace').hidden;
  sawResult ||= !game.querySelector('.dss-feature-result').hidden;
 }
 assert(sawTrace,'Winning ways must be traced after the graffiti transformation');
 assert(sawResult,'Final win screen appears after symbols and winning route are shown');
 assert.equal(game.querySelector('.dss-feature-result').hidden,true,'Feature result eventually finishes');
 game.stopAnimation();
});

test('Neon winning ways trace follows real matching positions and never replaces payout maths',()=>{
 const grid=Array(20).fill('Q');
 grid.splice(0,4,'A','wild','Q','Q');
 grid.splice(4,4,'Q','A','Q','Q');
 grid.splice(8,4,'Q','Q','A','Q');
 grid.splice(12,4,'Q','Q','Q','Q');
 const result=evaluate(grid);
 const winning=result.wins.find(x=>x.symbol==='A');
 assert(winning&&winning.matched===3&&winning.ways===2);
 const {document,window}=parseHTML('<html><body></body></html>');
 let elapsed=0,id=0;const jobs=[];
 const game=createDadsSecretStash(document,{
  rng:()=>.55,
  setTimeout:(fn,ms)=>{const job={id:++id,at:elapsed+ms,fn,done:false};jobs.push(job);return job.id;},
  clearTimeout:key=>{const job=jobs.find(x=>x.id===key);if(job)job.done=true;}
 });
 const advance=target=>{
  let guard=0;
  while(true){
   if(guard++>1500)throw Error('Win trace did not settle');
   jobs.sort((a,b)=>a.at-b.at);
   const job=jobs.find(x=>!x.done&&x.at<=target);
   if(!job)break;
   job.done=true;elapsed=job.at;job.fn();
  }
  elapsed=target;
 };
 const spinButton=[...game.querySelectorAll('button')].find(x=>x.textContent.includes('SPIN'));
 spinButton.dispatchEvent(new window.Event('click',{bubbles:true}));
 assert(game.getState().last.base.wins.length>0);
 advance(3300);
 const trace=game.querySelector('.dss-win-trace');
 assert.equal(trace.hidden,false,'Winning route must be visible after reel stop');
 const polyline=trace.querySelector('.dss-win-line');
 assert(polyline);
 const points=polyline.getAttribute('points').split(' ');
 assert(points.length>=7,'Full-width trace spans all five reel columns and both edges');
 assert.equal(points[0].split(',')[0],'0','Neon must begin at the left edge');
 assert.equal(points.at(-1).split(',')[0],'500','Neon must reach the right edge');
 for(const reelCenter of [50,150,250,350,450]){
  assert(points.some(point=>Number(point.split(',')[0])===reelCenter),'Trace crosses reel '+((reelCenter-50)/100+1));
 }
 assert.match(game.querySelector('.dss-win-label').textContent,/WAYS/);
 assert(game.querySelectorAll('.dss-paying-symbol').length>=3);
 advance(5100);
 assert.equal(trace.hidden,true,'Clear neon trace before next round or feature');
 assert.equal(game.querySelectorAll('.dss-paying-symbol').length,0);
 game.stopAnimation();
});

test('Dad cabinet uses the uploaded PNG rather than obsolete SVG',()=>{
 const machine=SLOT_MACHINES.find(x=>x.id==='dads-secret-stash');
 assert.equal(machine.art,'/assets/420bet/dads-secret-stash/lobby-cabinet.png');
 const file=new URL('../public'+machine.art,import.meta.url);
 assert(existsSync(file),'Uploaded lobby cabinet file missing');
 assert.deepEqual([...readFileSync(file).subarray(0,8)],[137,80,78,71,13,10,26,10]);
 const {document}=parseHTML('<html><body></body></html>');
 const lobby=createSlotsLobby(document);
 const card=[...lobby.querySelectorAll('.slots-machine-card')].find(x=>x.textContent.includes("Dad's Secret Stash"));
 assert.equal(card.querySelector('.slots-machine-art img').getAttribute('src'),machine.art);
});
test('All temporary bonus preview fixtures use the real feature engine and reject unknown modes',()=>{
 assert.deepEqual(BONUS_PREVIEW_TYPES,['stash','free','mow','jen','family','family-graffiti','keller','bud']);
 for(const key of BONUS_PREVIEW_TYPES){
  const {grid,event}=makeBonusPreview(key,()=>.6);
  assert.equal(grid.length,20);
  assert(event.units>=0);
  assert.equal(event.type,key==='family-graffiti'?'family':key);
  if(key==='family-graffiti')assert.equal(event.label,'WILD GRAFFITI');
  if(key==='stash')assert(event.steps.length>=4);
  if(key==='free')assert.equal(event.boards.length,event.spins);
  if(key==='keller')assert.equal(event.boards.length,event.spins);
 }
 assert.throws(()=>makeBonusPreview('made-up-feature'),/Unknown practice bonus preview/);
});
test('Temporary bonus preview launches real Hold & Win with NO bet, win, round, or history mutation',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 let now=0,id=0;const timers=[];
 const game=createDadsSecretStash(document,{
  rng:()=>.975,
  setTimeout:(fn,ms)=>{const job={id:++id,at:now+ms,fn,done:false};timers.push(job);return job.id;},
  clearTimeout:key=>{const job=timers.find(x=>x.id===key);if(job)job.done=true;}
 });
 const before=JSON.stringify(game.getState());
 const selector=game.querySelector('.dss-preview-select');
 const button=game.querySelector('.dss-preview-button');
 assert(selector&&button);
 assert.equal(selector.querySelector('option').getAttribute('value'),'stash');
 button.dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(game.querySelector('.dss-overlay').hidden,false);
 assert.equal(button.disabled,true);
 assert.equal(game.getState().balance,1000);
 assert.equal(game.getState().rounds,0);
 const advance=target=>{
  let guard=0;
  while(true){
   if(guard++>1000)throw Error('Preview did not finish');
   timers.sort((a,b)=>a.at-b.at);
   const next=timers.find(x=>!x.done&&x.at<=target);
   if(!next)break;
   next.done=true;now=next.at;next.fn();
  }
  now=target;
 };
 advance(3400);
 assert.equal(game.querySelector('.dss-hold-win').hidden,false,'Hold & Win uses actual board');
 advance(25000);
 assert.equal(game.querySelector('.dss-hold-win').hidden,true);
 assert.equal(button.disabled,false);
 assert.equal(JSON.stringify(game.getState()),before,'QA previews must restore entire original state');
 assert.match(game.querySelector('.dss-stat').textContent,/BALANCE 1000.00/);
 game.stopAnimation();
});
test('Temporary Family Chaos Wild Graffiti preview shows transformations without rewarding credits',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 let now=0,id=0;const timers=[];
 const game=createDadsSecretStash(document,{
  rng:()=>.5,
  setTimeout:(fn,ms)=>{const job={id:++id,at:now+ms,fn,done:false};timers.push(job);return job.id;},
  clearTimeout:key=>{const job=timers.find(x=>x.id===key);if(job)job.done=true;}
 });
 const before=JSON.stringify(game.getState());
 game.querySelector('.dss-preview-select option[value="family-graffiti"]').setAttribute('selected','');
 game.querySelector('.dss-preview-button').dispatchEvent(new window.Event('click',{bubbles:true}));
 const advance=target=>{
  let guard=0;
  while(true){
   if(guard++>1500)throw Error('Preview timing failed');
   timers.sort((a,b)=>a.at-b.at);
   const job=timers.find(x=>!x.done&&x.at<=target);
   if(!job)break;
   job.done=true;now=job.at;job.fn();
  }
  now=target;
 };
 advance(5000);
 assert.equal(game.querySelector('.dss-modifier-action').hidden,false);
 assert.equal(game.querySelector('.dss-modifier-action').dataset.outcome,'WILD GRAFFITI');
 advance(8300);
 assert(game.querySelectorAll('.dss-transformed').length>=1);
 advance(29500);
 assert.equal(JSON.stringify(game.getState()),before);
 game.stopAnimation();
});

test('Mow the Lawn runs all five cascades, and HOA has exactly five respins',()=>{
 const mower=mow(Array(20).fill('A'),()=>.55);
 assert.equal(mower.boards.length,5);
 assert.equal(mower.units,Math.round(mower.boards.reduce((sum,step)=>sum+step.units,0)*100)/100);
 for(const step of mower.boards){
  assert.equal(step.before.length,20);
  assert.equal(step.grid.length,20);
  step.before.forEach((symbol,i)=>{
   if(!step.removed.includes(i))assert.equal(step.grid[i],symbol,'Only mowed spots change');
  });
 }
 for(const n of [.1,.9]){
  const hoa=inspection(Array(20).fill('K'),()=>n);
  assert.equal(hoa.spins,5);
  assert.equal(hoa.boards.length,5);
 }
});
test('Hold and Win displays a seven-leaflet vector leaf instead of emoji and stops all five reels half a second apart',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 let elapsed=0,id=0;const queue=[];
 const game=createDadsSecretStash(document,{
  rng:()=>.975,
  setTimeout:(fn,ms)=>{const q={id:++id,at:elapsed+ms,fn,done:false};queue.push(q);return q.id;},
  clearTimeout:key=>{const q=queue.find(x=>x.id===key);if(q)q.done=true;}
 });
 const advance=t=>{
  let guard=0;
  while(true){
   if(guard++>4000)throw Error('Hold and Win preview did not complete');
   queue.sort((a,b)=>a.at-b.at);
   const q=queue.find(x=>!x.done&&x.at<=t);
   if(!q)break;
   q.done=true;elapsed=q.at;q.fn();
  }
  elapsed=t;
 };
 const hold=game.querySelector('.dss-hold-win');
 assert.equal(hold.querySelectorAll('.dss-cannabis-leaf').length,20);
 assert.equal(hold.querySelector('.dss-cannabis-leaf').querySelectorAll('.dss-leaf-blade').length,7);
 game.querySelector('.dss-preview-button').dispatchEvent(new window.Event('click',{bubbles:true}));
 advance(3700);
 assert.equal(hold.hidden,false);
 const tiles=[...hold.querySelectorAll('.dss-hold-cell')];
 assert(tiles.some(x=>x.classList.contains('dss-hold-cycling')),'Unfilled slots visibly spin during respins');
 assert(tiles.filter(x=>x.classList.contains('dss-hold-locked')).every(x=>!x.classList.contains('dss-hold-cycling')),'Previously collected prizes stay completely stationary');
 assert(tiles.filter(x=>x.classList.contains('dss-hold-cycling')).every(x=>x.querySelector('.dss-hold-value').textContent===''),'Animated empty slots show unobstructed moving leaf artwork instead of flashing question marks');
 const start=hold.querySelector('.dss-hold-tiles').dataset.lastStoppedReel;
 assert.equal(start,undefined);
 const stopTimes=[4650,5150,5650,6150,6650];
 for(let i=0;i<5;i++){
  advance(stopTimes[i]);
  assert.equal(hold.querySelector('.dss-hold-tiles').dataset.lastStoppedReel,String(i+1),'Stop reel '+(i+1));
  for(const tile of tiles.filter((_,index)=>index%5===i)){
   assert(!tile.classList.contains('dss-hold-cycling'),'Stopped reel positions no longer animate');
  }
  for(const tile of tiles.filter((tile,index)=>index%5>i&&!tile.classList.contains('dss-hold-locked'))){
   assert(tile.classList.contains('dss-hold-cycling'),'Unstopped columns continue animating');
  }
 }
 advance(25000);
 assert.equal(hold.hidden,true);
 assert.equal(game.getState().rounds,0);
 assert.equal(game.getState().balance,1000);
 game.stopAnimation();
});
test('The header owns feature progress and modifier captions, leaving reel row one uncovered',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const game=createDadsSecretStash(document);
 const header=game.querySelector('.dss-header');
 assert(header.querySelector('.dss-bonus-hud'));
 assert(header.querySelector('.dss-modifier-action'));
 assert.equal(game.querySelector('.dss-scene .dss-bonus-hud'),null);
 assert.equal(game.querySelector('.dss-scene .dss-modifier-action'),null);
 const css=readFileSync(new URL('../src/dads-secret-stash.css',import.meta.url),'utf8');
 const featureCss=css.slice(css.lastIndexOf('/* Slot #3 feature signoff'));
 assert(featureCss.includes('right:clamp(6px,1.4vw,22px)'));
 assert(featureCss.includes('.dss-larry-panel[data-mode="free"]'));
 assert(featureCss.includes('.dss-larry-panel[data-mode="mow"]'));
 assert(featureCss.includes('.dss-portrait[hidden]{display:none!important}'));
 game.stopAnimation();
});

test('Free spins use lighter Wild strips and bounded sticky accumulation without altering 8/15/22 feature lengths',()=>{
 assert.equal(FREE_WEIGHTS.length,20);
 assert.equal(FREE_WEIGHTS[SYMBOLS.indexOf('wild')],1.526);
 assert.equal(FREE_STICKY_LIMIT,6);
 assert.deepEqual(FREE_MULTIPLIER_STAGES,[1,2,4]);
 for(const seed of [.001,.499,.999]){
  const bonus=freeBonus(()=>seed);
  assert([8,15,22].includes(bonus.spins));
  assert.equal(bonus.boards.length,bonus.spins);
  let previous=[];
  for(let i=0;i<bonus.boards.length;i++){
   const step=bonus.boards[i];
   assert(step.sticky.length<=6,'Sticky Wild positions may never exceed six');
   assert(step.grid.filter(x=>x==='wild').length<=6,'All Wilds on free board must honor cap');
   for(const index of previous)assert.equal(step.grid[index],'wild','Existing Sticky Wild must remain');
   previous=step.sticky;
   assert.equal(step.mult,i<6?1:i<12?2:4);
  }
  assert.equal(bonus.units,Math.round(bonus.boards.reduce((sum,step)=>sum+step.units,0)*100)/100);
 }
});
test('Recalibrated Stash prizes, Family Graffiti and Bud conversions preserve their features',()=>{
 const stash=stashBonus(()=>.975);
 assert.equal(stash.steps.length,4);
 assert(stash.prizes.every(x=>x<=6.6));
 assert.equal(stash.units,19.8);
 const familyGrid=Array(20).fill('A');familyGrid[0]='tyler';familyGrid[1]='emma';
 const graffiti=modifier(familyGrid,'family',()=>.3);
 assert.equal(graffiti.label,'WILD GRAFFITI');
 assert.equal(graffiti.grid.filter(x=>x==='wild').length,2);
 const fetch=modifier(Array(20).fill('A'),'bud',()=>.5);
 assert.equal(fetch.label,'FETCH WILD!');
 assert.equal(fetch.grid.filter(x=>x==='wild').length,3);
 assert.equal(inspection(Array(20).fill('A'),()=>.3).spins,5);
 assert.equal(mow(Array(20).fill('A'),()=>.3).boards.length,5);
});

test('Free-spin reels stop at 1000/1500/2000/2500/3000ms and preserve all previously sticky Wilds',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 let now=0,id=0;const jobs=[];
 const clock={
  rng:()=>.976,
  setTimeout:(fn,ms)=>{const job={id:++id,at:now+ms,fn,done:false};jobs.push(job);return job.id;},
  clearTimeout:(key)=>{const job=jobs.find(x=>x.id===key);if(job)job.done=true;}
 };
 const advance=(until)=>{
  let guard=0;
  while(true){
   if(guard++>10000)throw Error('Free-spin sequence did not settle');
   jobs.sort((a,b)=>a.at-b.at);
   const job=jobs.find(x=>!x.done&&x.at<=until);
   if(!job)break;job.done=true;now=job.at;job.fn();
  }
  now=until;
 };
 const game=createDadsSecretStash(document,clock);
 game.querySelector('.dss-preview-select option[value="free"]').setAttribute('selected','');
 game.querySelector('.dss-preview-button').dispatchEvent(new window.Event('click',{bubbles:true}));
 const reels=[...game.querySelectorAll('.dss-reel')];
 const original=game.getState().last.events[0].boards[0];
 assert.equal(game.getState().rounds,0,'Preview does not place a paid or practice wager');
 advance(2800); // 1600ms introduction + 1200ms outcome announcement
 assert(reels.every(reel=>reel.classList.contains('dss-free-spinning')),'All reels start spinning together');
 for(let reel=0;reel<5;reel++){
  advance(2800+1000+reel*500-50);
  assert(reels[reel].classList.contains('dss-spinning'),'Reel '+(reel+1)+' must continue spinning');
  advance(2800+1000+reel*500);
  assert.equal(reels[reel].dataset.freeStop,String(1000+reel*500));
  assert(!reels[reel].classList.contains('dss-spinning'),'Reel '+(reel+1)+' stops');
  assert(reels.slice(reel+1).every(x=>x.classList.contains('dss-spinning')),'Later reels continue spinning');
  const symbols=[...reels[reel].querySelectorAll('.dss-cell')].map(x=>x.dataset.symbol);
  assert.deepEqual(symbols,original.grid.slice(reel*4,reel*4+4));
 }
 assert.equal(game.querySelector('.dss-larry-panel').dataset.mode,'free');
 assert.equal(game.querySelector('.dss-bonus-hud').hidden,false);
 // The second spin must retain all sticky positions from the first.
 advance(2800+3000+680+500+300);
 const second=game.getState().last.events[0].boards[1];
 const past=original.sticky;
 for(const i of past){
  const symbol=game.querySelectorAll('.dss-cell')[i];
  assert.equal(symbol.dataset.symbol,'wild');
  assert(second.previous.includes(i));
 }
 assert.equal(game.getState().rounds,0);
 game.stopAnimation();
});
test('A ten-percent prize-only RTP adjustment leaves all other bonus mechanics untouched',()=>{
 const rng=()=>.975;
 const bonus=stashBonus(rng);
 assert.deepEqual(bonus.prizes,[6.6,6.6,6.6]);
 assert.equal(bonus.units,19.8);
 assert.equal(bonus.steps.length,4);
 assert.equal(inspection(Array(20).fill('A'),rng).spins,5);
 assert.equal(mow(Array(20).fill('A'),rng).boards.length,5);
});

test('Previously held Sticky Wilds are exempt from reel travel and stop shake',()=>{
 const css=readFileSync(new URL('../src/dads-secret-stash.css',import.meta.url),'utf8');
 const override=css.slice(css.lastIndexOf('/* Collected Sticky Wilds must stay motionless'));
 assert.match(override,/\.dss-reel\.dss-free-spinning \.dss-cell\.dss-sticky \.dss-symbol-image/);
 assert.match(override,/\.dss-reel\.dss-spinning \.dss-cell\.dss-sticky \.dss-symbol-image/);
 assert.match(override,/animation:none;\s*transform:none;\s*filter:drop-shadow/);
 assert.match(override,/\.dss-reel\.dss-stopping \.dss-cell\.dss-sticky\s*\{\s*animation:none;\s*transform:none;/);
 const ui=readFileSync(new URL('../src/dads-secret-stash-ui.js',import.meta.url),'utf8');
 assert.match(ui,/if\(!locked\.has\(i\)\)setCell\(i,SYMBOLS\[/,'Held Sticky Wilds must not be cycled by JS');
 assert.match(ui,/const locked=new Set\(entry\.previous\?\?\[\]\)/);
});

test('Hold & Win empty cells show a recognizable large seven-tip cannabis leaf instead of overlapping blades',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const game=createDadsSecretStash(document);
 const leaves=[...game.querySelectorAll('.dss-hold-cell .dss-cannabis-leaf')];
 assert.equal(leaves.length,20,'All twenty prize spaces use the leaf placeholder');
 const leaf=leaves[0],blades=[...leaf.querySelectorAll('.dss-leaf-blade')];
 assert.equal(blades.length,7);
 assert.equal(leaf.getAttribute('viewBox'),'0 0 100 100');
 assert.equal(leaf.querySelectorAll('.dss-leaf-stem').length,1);
 const distinctPaths=new Set(blades.map(x=>x.getAttribute('d')));
 assert.equal(distinctPaths.size,7,'Cannabis leaflets need distinct silhouettes');
 assert(blades.every(x=>!x.hasAttribute('transform')),'Do not rotate the same blade onto itself');
 assert(blades.every(x=>x.getAttribute('d').split(' L').length>=30),'Each leaflet should have separated serrated contours');
 const css=readFileSync(new URL('../src/dads-secret-stash.css',import.meta.url),'utf8');
 assert.match(css,/\.dss-cannabis-leaf\{[^}]*width:72%;height:86%;max-width:114px/);
 assert.match(css,/\.dss-hold-cell\.dss-hold-cycling \.dss-cannabis-leaf\{[^}]*animation:dss-leaf-reel-cycle \.18s linear infinite;/);
 assert.match(css,/@keyframes dss-hold-reel-backdrop/);
 assert.match(css,/\.dss-hold-locked \.dss-cannabis-leaf\{display:none\}/);
 game.stopAnimation();
});

test('Full-width neon route geometry matches the complete five-reel SVG canvas',()=>{
 const css=readFileSync(new URL('../src/dads-secret-stash.css',import.meta.url),'utf8');
 const canvas=css.slice(css.indexOf('.dss-win-svg{'),css.indexOf('.dss-win-svg polyline{'));
 assert.match(canvas,/inset:0;width:100%;height:100%/);
 const source=readFileSync(new URL('../src/dads-secret-stash-ui.js',import.meta.url),'utf8');
 assert.match(source,/route\.unshift\('0,'\+firstY\)/);
 assert.match(source,/for\(let reel=win\.matched;reel<5;reel\+\+\)/);
 assert.match(source,/route\.push\('500,'\+lastY\)/);
});

test('Gold textured 3D SPIN artwork replaces the old emoji button without changing click semantics',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const game=createDadsSecretStash(document,{rng:()=>.55});
 const spinButton=game.querySelector('.dss-button.dss-spin');
 assert(spinButton);
 assert.equal(spinButton.textContent,'SPIN');
 assert.equal(spinButton.getAttribute('type'),'button');
 const svgPath=new URL('../public/assets/420bet/dads-secret-stash/spin-button-gold.svg',import.meta.url);
 assert(existsSync(svgPath),'Textured spin image must be committed');
 const svg=readFileSync(svgPath,'utf8');
 assert.match(svg,/data:image\/webp;base64,/);
 assert(svg.length>5500,'Rasterized gold button art must be embedded, not empty flat vector');
 const css=readFileSync(new URL('../src/dads-secret-stash.css',import.meta.url),'utf8');
 assert(css.includes("spin-button-gold.svg"));
 assert(css.includes('.dss-controls .dss-button.dss-spin:hover:not(:disabled)'));
 assert(css.includes('.dss-controls .dss-button.dss-spin:active:not(:disabled)'));
 spinButton.dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(game.getState().rounds,1,'Gold button must invoke same real practice spin');
 game.stopAnimation();
});
test('Mow replaces every triggering mower on the board before the first of five cascades',()=>{
 const original=Array(20).fill('A');
 for(const i of [0,4,9,16])original[i]='mower';
 const bonus=mow(original,()=>.55);
 assert.deepEqual(bonus.mowerIndices,[0,4,9,16]);
 assert.equal(bonus.initialGrid.length,20);
 assert(bonus.mowerIndices.every(i=>bonus.initialGrid[i]!=='mower'));
 for(let i=0;i<20;i++)if(original[i]!=='mower')assert.equal(bonus.initialGrid[i],original[i]);
 assert.equal(bonus.boards.length,5);
 assert.deepEqual(bonus.boards[0].before,bonus.initialGrid);
 for(const entry of bonus.boards){
  assert(!entry.before.includes('mower'),'Cascades must never resurrect triggering mowers');
  assert(!entry.grid.includes('mower'),'Cascades must remain free of triggering mowers');
 }
});
test('Lawn payout scaling matches actual cascade awards and displayed neon routes',()=>{
 assert.equal(MOW_PAYOUT_FACTOR,0.65);
 const original=Array(20).fill('A');for(const i of [2,7,17])original[i]='mower';
 const game=mow(original,()=>.55);
 assert.equal(game.boards.length,5);
 for(const step of game.boards){
  assert.equal(step.units,Math.round(evaluate(step.grid).units*MOW_PAYOUT_FACTOR*100)/100);
 }
 const ui=readFileSync(new URL('../src/dads-secret-stash-ui.js',import.meta.url),'utf8');
 assert.match(ui,/amount:win\.amount\*MOW_PAYOUT_FACTOR/);
});
test('Mow preview visibly removes all mower symbols and only then starts cascading',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 let now=0,id=0;const timers=[];
 const game=createDadsSecretStash(document,{
  rng:()=>.55,
  setTimeout:(fn,ms)=>{const job={id:++id,when:now+ms,fn,done:false};timers.push(job);return job.id;},
  clearTimeout:key=>{const job=timers.find(x=>x.id===key);if(job)job.done=true;}
 });
 const advance=time=>{
  let guard=0;
  while(true){
   if(guard++>2000)throw Error('Mower sequence did not finish');
   timers.sort((a,b)=>a.when-b.when);
   const job=timers.find(x=>!x.done&&x.when<=time);
   if(!job)break;
   job.done=true;now=job.when;job.fn();
  }
  now=time;
 };
 game.querySelector('.dss-preview-select option[value="mow"]').setAttribute('selected','');
 game.querySelector('.dss-preview-button').dispatchEvent(new window.Event('click',{bubbles:true}));
 const event=game.getState().last.events[0];
 assert.equal(event.type,'mow');
 assert.equal(event.mowerIndices.length,3);
 advance(2800);
 assert(event.mowerIndices.every(i=>game.querySelectorAll('.dss-cell')[i].dataset.symbol==='mower'),'Trigger symbols show during opening');
 assert.equal(game.querySelectorAll('.dss-mower-replacing').length,3);
 advance(2980);
 assert(event.mowerIndices.every(i=>game.querySelectorAll('.dss-cell')[i].dataset.symbol!=='mower'),'Remove all mowers before cascade 1');
 assert.equal(game.querySelectorAll('.dss-clearing').length,0,'First cascade has not started');
 advance(3530);
 assert(game.querySelectorAll('.dss-clearing').length>0,'Only after mower replacement does first cascade start');
 assert.equal(game.getState().rounds,0,'Bonus test does not count as a real spin');
 game.stopAnimation();
});

test('Family Chaos Scatter Scramble awards free spins on the final FOUR-scatter grid',()=>{
 // Force the exact reported case: 2 scatters on the spin, then Family
 // Chaos contributes another 2. RNG affects outcomes only through spin().
 const symbolRng=symbol=>{
  for(let i=0;i<2000;i++)if(draw(()=>i/2000)===symbol)return i/2000;
  throw Error('No draw probability for '+symbol);
 };
 const grid=Array(20).fill('A');
 grid[0]='scatter';grid[1]='scatter';grid[2]='tyler';grid[3]='emma';
 const sequence=[...grid.map(symbolRng),.1,.6,.9,.2,.4];
 const rng=()=>sequence.length?sequence.shift():.5;
 const result=spin(newGame(),rng).last;
 assert.equal(result.grid.filter(s=>s==='scatter').length,2);
 const family=result.events.find(e=>e.type==='family');
 assert(family,'Family Chaos should be triggered');
 assert.equal(family.label,'SCATTER SCRAMBLE');
 assert.equal(family.grid.filter(s=>s==='scatter').length,4);
 assert.equal(family.awardedFreeSpins,true);
 assert.equal(family.scatterCount,4);
 const free=result.events.filter(e=>e.type==='free');
 assert.equal(free.length,1,'Four scatters must award exactly one free-spin bonus');
 assert.equal(free[0].triggerSource,'family-scatter-scramble');
 assert.equal(free[0].triggerScatterCount,4);
 assert([8,15,22].includes(free[0].spins));
 assert(free[0].boards.length>0,'Free spins have genuine reel outcomes');
 assert(result.events.indexOf(family)<result.events.indexOf(free[0]),'Show transformation before free spins');
 const expected=result.base.units+result.events.reduce((sum,e)=>sum+e.units,0);
 assert.equal(result.win,Math.min(10000,Math.round(expected*100)/100));
});
test('Family Scatter Scramble never grants duplicate free spins or premature triggers',()=>{
 const pick=symbol=>{
  for(let i=0;i<2000;i++)if(draw(()=>i/2000)===symbol)return i/2000;
  throw Error('Cannot draw '+symbol);
 };
 const go=(originalScatters,newScatters)=>{
  const grid=Array(20).fill('A');
  for(let i=0;i<originalScatters;i++)grid[i]='scatter';
  grid[4]='tyler';grid[5]='emma';
  const rngs=[...grid.map(pick),.1,.6,newScatters===2?.9:.1,.2,.4];
  return spin(newGame(),()=>rngs.length?rngs.shift():.5).last;
 };
 const baseQualified=go(3,2);
 assert.equal(baseQualified.events.filter(x=>x.type==='free').length,1,'Base 3+ plus Family additions earns only one free feature');
 const insufficient=go(1,1);
 assert.equal(insufficient.events.filter(x=>x.type==='free').length,0,'Two scatters are not enough');
 const transformed=insufficient.events.find(x=>x.type==='family');
 assert.equal(transformed.awardedFreeSpins,undefined);
});
test('Family Chaos scatter award highlights matching symbols before the free-spin presentation',()=>{
 const ui=readFileSync(new URL('../src/dads-secret-stash-ui.js',import.meta.url),'utf8');
 assert(ui.includes('event.scatterCount+\' SCATTERS — FREE SPINS UNLOCKED!\''));
 assert(ui.includes("cell.classList.toggle('dss-trigger-scatter',final[i]==='scatter')"));
 assert(ui.includes("cell.classList.remove('dss-locked','dss-trigger-scatter')"));
 const css=readFileSync(new URL('../src/dads-secret-stash.css',import.meta.url),'utf8');
 assert.match(css,/\.dss-reel \.dss-cell\.dss-trigger-scatter/);
});

test('All Jen, Family, Bud, and HOA comic titles explain the actual selected action',()=>{
 assert.equal(DSS_BONUS_PRESENTATION.comicActionMs,1500);
 const expected={
  jen:['HIDE THE STASH','PANIC WILDS','GARAGE CLEANUP','CAUGHT RED-HANDED'],
  family:['LOW SYMBOL UPGRADE','WILD GRAFFITI','SCATTER SCRAMBLE','GARAGE MAYHEM'],
  bud:['FETCH WILD!'],
  keller:['HOA INSPECTION']
 };
 for(const [type,labels] of Object.entries(expected)){
  for(const label of labels){
   const copy=comicActionCopy({type,label});
   assert.match(copy.title,/^[A-Z0-9 !'-]+$/,'Action title should use bold uppercase copy');
   assert(copy.detail.length>=22,'Each action needs a meaningful explanatory subtitle');
   assert.notEqual(copy.detail,'BONUS FEATURE ACTIVATED!');
  }
 }
 const unlock=comicActionCopy({type:'family',label:'SCATTER SCRAMBLE',awardedFreeSpins:true,scatterCount:4});
 assert.match(unlock.detail,/4 SCATTERS/);
 assert.match(unlock.detail,/FREE SPINS UNLOCKED/);
});
test('Comic result stays over the reels for precisely 1500ms before character feature actions begin',()=>{
 for(const requested of ['family-graffiti','jen','bud','keller']){
  const {document,window}=parseHTML('<html><body></body></html>');
  let now=0,id=0;const tasks=[];
  const game=createDadsSecretStash(document,{
   rng:()=>.5,
   setTimeout:(fn,ms)=>{const task={id:++id,at:now+ms,fn,done:false};tasks.push(task);return task.id;},
   clearTimeout:key=>{const task=tasks.find(t=>t.id===key);if(task)task.done=true;}
  });
  const advance=until=>{
   let guard=0;
   while(true){
    if(guard++>3000)throw Error('Comic action sequence did not settle');
    tasks.sort((a,b)=>a.at-b.at);
    const task=tasks.find(t=>!t.done&&t.at<=until);
    if(!task)break;
    task.done=true;now=task.at;task.fn();
   }
   now=until;
  };
  game.querySelector('.dss-preview-select option[value="'+requested+'"]').setAttribute('selected','');
  game.querySelector('.dss-preview-button').dispatchEvent(new window.Event('click',{bubbles:true}));
  const overlay=game.querySelector('.dss-overlay'),card=game.querySelector('.dss-comic-action');
  assert.equal(overlay.hidden,false);
  assert.equal(card.hidden,true);
  advance(2799);
  assert.equal(card.hidden,true,'Character intro still visible just before comic');
  advance(2800);
  assert.equal(card.hidden,false,'Comic must open after character splash');
  assert.equal(overlay.hidden,false,'Cover reels during action reveal');
  assert(overlay.classList.contains('dss-comic-active'));
  assert(card.querySelector('.dss-comic-title').textContent.length>4);
  assert(card.querySelector('.dss-comic-detail').textContent.length>15);
  assert.equal(game.querySelector('.dss-feature-result').hidden,true);
  advance(4299);
  assert.equal(card.hidden,false,'Comic remains for the complete 1500ms');
  assert.equal(overlay.hidden,false,'Reels remain concealed until comic ends');
  advance(4300);
  assert.equal(card.hidden,true,'Comic ends at 1500ms');
  assert.equal(overlay.hidden,true,'Reel board revealed before its action plays');
  assert(!overlay.classList.contains('dss-comic-active'));
  if(requested==='family-graffiti'){
   assert.equal(game.querySelector('.dss-modifier-action').hidden,false,'Graffiti starts after comic');
  }else if(requested==='keller'){
   assert.equal(game.querySelector('.dss-bonus-hud').hidden,false,'HOA respins begin after comic');
  }
  assert.equal(game.getState().rounds,0,'Comic demo cannot alter spin history');
  game.stopAnimation();
 }
 const css=readFileSync(new URL('../src/dads-secret-stash.css',import.meta.url),'utf8');
 assert.match(css,/\.dss-comic-action\[hidden\]\{display:none!important\}/);
 assert.match(css,/\.dss-overlay\.dss-comic-active > :not\(\.dss-comic-action\)\{visibility:hidden\}/);
 assert.match(css,/\.dss-comic-title\{[^}]*font-size:clamp\(30px,5\.2vw,78px\)/);
});

test('Jen Hide the Stash awards Hold & Win when two original crates become four',()=>{
 const pick=symbol=>{
  for(let i=0;i<2000;i++)if(draw(()=>i/2000)===symbol)return i/2000;
  throw Error('Cannot draw '+symbol);
 };
 const grid=Array(20).fill('A');
 grid[0]='stash';grid[4]='stash';
 grid[1]='jen';grid[5]='jen';grid[9]='jen';
 const calls=[...grid.map(pick),.1,.0,.0,.0,.0]; // Jen qualifies, HIDE selected, two crates added.
 const result=spin(newGame(),()=>calls.length?calls.shift():.5).last;
 assert.equal(result.grid.filter(x=>x==='stash').length,2);
 const jen=result.events.find(x=>x.type==='jen');
 assert(jen,'Jen's mystery modifier should trigger');
 assert.equal(jen.label,'HIDE THE STASH');
 assert.equal(jen.grid.filter(x=>x==='stash').length,4);
 assert.equal(jen.awardedHoldAndWin,true);
 assert.equal(jen.stashCount,4);
 const hold=result.events.filter(x=>x.type==='stash');
 assert.equal(hold.length,1,'One Hold & Win bonus must be awarded');
 assert.equal(hold[0].triggerSource,'jen-hide-the-stash');
 assert.equal(hold[0].triggerStashCount,4);
 assert(hold[0].steps.length>=4,'Real Hold & Win spins, not just an announcement');
 assert(result.events.indexOf(jen)<result.events.indexOf(hold[0]),'Jen transformation must play before Hold & Win');
 const expected=result.base.units+result.events.reduce((sum,x)=>sum+x.units,0);
 assert.equal(result.win,Math.min(10000,Math.round(expected*100)/100),'Hold & Win award credited to the same practice spin');
});
test('Jen Hide the Stash checks threshold, and base/added crates never double-trigger',()=>{
 const pick=symbol=>{
  for(let i=0;i<2000;i++)if(draw(()=>i/2000)===symbol)return i/2000;
  throw Error('Cannot draw '+symbol);
 };
 const run=(initialCrates,addedCount)=>{
  const grid=Array(20).fill('A');
  for(let i=0;i<initialCrates;i++)grid[i]='stash';
  grid[8]='jen';grid[9]='jen';grid[10]='jen';
  const rngs=[...grid.map(pick),.1,.0,addedCount===2?.0:.3,.0,.0,.0,.0];
  const result=spin(newGame(),()=>rngs.length?rngs.shift():.5).last;
  return result;
 };
 const already=run(3,2);
 assert.equal(already.events.filter(x=>x.type==='stash').length,1,'Three base crates and added crates must award only once');
 const insufficient=run(0,2);
 assert.equal(insufficient.events.filter(x=>x.type==='stash').length,0,'Only two transformed crates must not award Hold & Win');
 assert.equal(insufficient.events.find(x=>x.type==='jen').awardedHoldAndWin,undefined);
});
test('Jen's comic announcement and complete grid display Hold & Win qualification',()=>{
 const ui=readFileSync(new URL('../src/dads-secret-stash-ui.js',import.meta.url),'utf8');
 assert.match(ui,/event\.stashCount\+' STASH CRATES! SECRET STASH HOLD & WIN UNLOCKED!'/);
 assert.match(ui,/event\.stashCount\+' STASH CRATES — HOLD & WIN UNLOCKED!'/);
 assert.match(ui,/cell\.classList\.toggle\('dss-trigger-stash',final\[i\]==='stash'\)/);
 assert.match(ui,/cell\.classList\.remove\('dss-locked','dss-trigger-scatter','dss-trigger-stash'\)/);
 const css=readFileSync(new URL('../src/dads-secret-stash.css',import.meta.url),'utf8');
 assert.match(css,/\.dss-reel \.dss-cell\.dss-trigger-stash/);
});
