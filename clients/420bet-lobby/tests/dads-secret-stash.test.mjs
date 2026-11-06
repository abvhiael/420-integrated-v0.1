import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {existsSync,readFileSync} from 'node:fs';
import {SLOT_MACHINES,createSlotsLobby,slotMachineFromHash} from '../src/slots-lobby.js';
import {newGame,qualify,triggerCharacters,modifier,inspection,spin,evaluate,stashBonus,freeBonus,mow,makeBonusPreview,BONUS_PREVIEW_TYPES} from '../src/dads-secret-stash-engine.js';
import {createDadsSecretStash,DSS_BONUS_PRESENTATION} from '../src/dads-secret-stash-ui.js';
import {DSS_SYMBOL_ART,DSS_CAST_ART,DSS_TRANSITION_ART,DSS_BACKGROUND_ART,DSS_FEATURE_ART,DSS_LARRY_ART} from '../src/dads-secret-stash-assets.js';
import {SYMBOLS} from '../src/dads-secret-stash-engine.js';
const board=()=>Array(20).fill('A');const seq=(value)=>()=>value;
test('Slot #3 routes to own page and lobby keeps three cabinets in view',()=>{assert(SLOT_MACHINES.length>=3);assert.equal(SLOT_MACHINES[2].id,'dads-secret-stash');assert.equal(slotMachineFromHash('#game=slots&machine=dads-secret-stash')?.title,"Dad's Secret Stash");const {document}=parseHTML('<html><body></body></html>');const lobby=createSlotsLobby(document);assert.equal(lobby.querySelectorAll('.slots-machine-card').length,SLOT_MACHINES.length);assert.equal([...lobby.querySelectorAll('.slots-machine-card')].filter(x=>!x.hidden).length,3);assert.equal(lobby.querySelectorAll('.slots-carousel-arrow').length,2);});
test('Character conditions require exact thresholds',()=>{const jen=board();jen[0]=jen[1]=jen[2]='jen';assert.equal(qualify(jen).jen,true);jen[2]='A';assert.equal(qualify(jen).jen,false);const family=board();family[3]='tyler';family[4]='emma';assert.equal(qualify(family).family,true);const k=board();k[0]=k[1]=k[2]='keller';assert.equal(qualify(k).keller,true);const bud=board();bud[0]=bud[1]=bud[2]='bud';assert.equal(qualify(bud).bud,true);});
test('25 percent conditional trigger independently applies to every feature',()=>{const grid=board();grid.splice(0,3,'jen','jen','jen');grid.splice(3,3,'keller','keller','keller');grid.splice(6,3,'bud','bud','bud');grid[9]='tyler';grid[10]='emma';assert.deepEqual(triggerCharacters(grid,seq(.249)),{jen:true,family:true,keller:true,bud:true});assert.deepEqual(triggerCharacters(grid,seq(.25)),{jen:false,family:false,keller:false,bud:false});});
test('Jen outcome selectors and fetch wild preserve 5x4 grid',()=>{const grid=board();const jen=modifier(grid,'jen',seq(.3));assert.equal(jen.label,'PANIC WILDS');assert(jen.grid.filter(s=>s==='wild').length>=2);const bud=modifier(grid,'bud',seq(.5));assert.equal(bud.label,'FETCH WILD!');assert(bud.grid.filter(s=>s==='wild').length>=2);});
test('HOA inspection only grants two to five respins and locks premiums',()=>{const grid=board();grid[0]='gary';for(const n of [.0,.99]){const out=inspection(grid,seq(n));assert(out.spins>=2&&out.spins<=5);assert.equal(out.boards.length,out.spins);assert(out.boards.every(b=>b.grid[0]==='gary'));}});
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
 const block=css.slice(css.lastIndexOf('/* Regular-play Larry:'));
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
 assert.equal(empty.units,empty.prizes.reduce((a,b)=>a+b,0));
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
 assert.match(source,/schedule\(advance,950\)/);
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
 assert.equal(bonus.hidden,false,'Keep bonus scene visible through all respins and final result');
 advance(12500);
 assert.equal(bonus.hidden,true,'Bonus scene should exit after payout reveal');
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
 advance(7800);
 assert.equal(game.querySelector('.dss-modifier-action').hidden,false);
 assert.deepEqual(cells.map(x=>x.dataset.symbol),initial,'Original reel symbols visible before graffiti');
 advance(9250);
 assert(cells.some((x,i)=>x.dataset.symbol!==initial[i]),'At least one reel symbol transforms before the result');
 assert.equal(game.querySelector('.dss-feature-result').hidden,true,'Win popup must not obscure transformations');
 advance(11500);
 assert.deepEqual(cells.map(x=>x.dataset.symbol),event.grid,'All changed reel positions should match calculated result');
 let sawTrace=false,sawResult=false;
 for(let time=11600;time<=30000;time+=100){
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
 assert(polyline.getAttribute('points').split(' ').length>=3);
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
 selector.value='stash';
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
 game.querySelector('.dss-preview-select').value='family-graffiti';
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
 advance(3500);
 assert.equal(game.querySelector('.dss-modifier-action').hidden,false);
 assert.equal(game.querySelector('.dss-modifier-action').dataset.outcome,'WILD GRAFFITI');
 advance(6800);
 assert(game.querySelectorAll('.dss-transformed').length>=1);
 advance(28000);
 assert.equal(JSON.stringify(game.getState()),before);
 game.stopAnimation();
});
