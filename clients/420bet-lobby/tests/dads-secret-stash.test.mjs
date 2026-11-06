import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {existsSync,readFileSync} from 'node:fs';
import {SLOT_MACHINES,createSlotsLobby,slotMachineFromHash} from '../src/slots-lobby.js';
import {newGame,qualify,triggerCharacters,modifier,inspection,spin,evaluate,stashBonus} from '../src/dads-secret-stash-engine.js';
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
 assert.match(source,/schedule\(\(\)=>\{holdWin\.hidden=true;reels\.hidden=false;nextEvent\(\);\},1800\)/);
 game.stopAnimation();
});
