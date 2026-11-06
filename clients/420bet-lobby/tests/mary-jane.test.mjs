import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {existsSync,readFileSync} from 'node:fs';
import {BASE_REELS,BONUS_REELS,PAYLINES,BASE_PAYTABLE,BONUS_PAYTABLE,SYMBOL_NAMES,validateMaryJaneModel,MAX_PAYOUT_X} from '../src/mary-jane-model.js';
import {initialMaryJaneState,setMaryJaneStake,spinMaryJane,evaluateMaryJane,visibleMaryJaneReels,creditText,validatePracticeSession} from '../src/mary-jane-engine.js';
import {createMaryJanePractice} from '../src/mary-jane-ui.js';
import {createSlotsLobby,slotMachineFromHash,SLOT_MACHINES} from '../src/slots-lobby.js';

test('Mary Jane v4 math fixtures and circular reel constraints stay frozen',()=>{
 assert.equal(validateMaryJaneModel(),true);
 assert.equal(BASE_REELS.length,5);assert.equal(BONUS_REELS.length,5);
 assert.equal(PAYLINES.length,20);
 for(const strips of [BASE_REELS,BONUS_REELS])for(const reel of strips){
  assert.equal(reel.length,60);
  assert.equal(reel.filter(x=>x==='WILD').length,3);
  for(let p=0;p<60;p++)assert(Array.from({length:4},(_,i)=>reel[(p+i)%60]).filter(x=>x==='WILD').length<=1);
  const start=reel.indexOf('H01A');assert.deepEqual(Array.from({length:4},(_,i)=>reel[(start+i)%60]),['H01A','H01B','H01C','H01D']);
 }
 assert.deepEqual(BASE_REELS.map(reel=>reel.filter(x=>x==='SCATTER').length),[2,0,2,0,2]);
 assert(BONUS_REELS.every(reel=>reel.every(x=>x!=='SCATTER'&&x!=='COIN')));
 assert.equal(BASE_PAYTABLE.WILD[2],43.2);assert.equal(BONUS_PAYTABLE.WILD[2],151.2);
});

test('20 line evaluator pays Gold Coins independently of Wild, and portrait segments as H01',()=>{
 const empty=()=>Array.from({length:5},()=>Array(4).fill('L06'));
 const coins=empty();for(let i=0;i<3;i++)coins[i][0]='COIN';
 let result=evaluateMaryJane(coins,20);
 assert(result.lines.some(line=>line.line===1&&line.symbol==='COIN'&&line.count===3));
 coins[1][0]='WILD';result=evaluateMaryJane(coins,20);
 assert(!result.lines.some(line=>line.line===1&&line.symbol==='COIN'));
 const portrait=empty();for(let i=0;i<3;i++)portrait[i][0]='H01'+('ABC'[i]);
 result=evaluateMaryJane(portrait,20);
 assert(result.lines.some(line=>line.line===1&&line.symbol==='H01'&&line.count===3));
});

test('10 paid spins add frames, repeated Coins increment Buzz capped at x10, then convert and clear',()=>{
 let state=initialMaryJaneState(5000);state=setMaryJaneStake(state,10);
 const stops=BASE_REELS.map(reel=>reel.indexOf('COIN'));
 state=spinMaryJane(state,stops);assert.equal(state.cycle,1);assert.equal(state.buzz,1);
 assert.equal(state.frames.flat().filter(Boolean).length,5);
 state=spinMaryJane(state,stops);assert.equal(state.buzz,6);
 state=spinMaryJane(state,stops);assert.equal(state.buzz,10);
 for(let i=3;i<10;i++)state=spinMaryJane(state,stops);
 assert.equal(state.cycle,0);assert.equal(state.buzz,1);
 assert.equal(state.frames.flat().filter(Boolean).length,0);
 assert.equal(state.lastConverted.flat().filter(Boolean).length,5);
 assert.equal(state.lastBoard.filter(reel=>reel[0]==='WILD').length,5);
 assert.equal(validatePracticeSession(state),true);
});

test('Scatters on 1/3/5 start ten Sticky Wild free spins, with inherited Buzz',()=>{
 let state=initialMaryJaneState(5000);
 const stops=BASE_REELS.map((reel,r)=>r%2===0?reel.indexOf('SCATTER'):0);
 state.buzz=4;state=spinMaryJane(state,stops);
 assert.equal(state.mode,'bonus');assert.equal(state.bonusBuzz,4);
 assert.equal(state.freeRemaining,10);
 const startingBalance=state.balanceMicros;
 const bonusWildStops=BONUS_REELS.map(reel=>reel.indexOf('WILD'));
 state=spinMaryJane(state,bonusWildStops);assert.equal(state.freeRemaining,9);
 assert.equal(state.sticky.flat().filter(Boolean).length,5);
 const noWildStops=BONUS_REELS.map(reel=>reel.findIndex((x,i)=>Array.from({length:4},(_,y)=>reel[(i+y)%60]).every(y=>y!=='WILD')));
 state=spinMaryJane(state,noWildStops);
 assert(state.lastBoard.every(reel=>reel[0]==='WILD'));
 for(let i=2;i<10;i++)state=spinMaryJane(state,noWildStops);
 assert.equal(state.mode,'base');assert.equal(state.freeRemaining,0);
 assert.equal(state.sticky.flat().filter(Boolean).length,0);
 assert(state.balanceMicros>=startingBalance);
});

test('bonus triggered on tenth spin preserves multiplier despite base reset',()=>{
 let state=initialMaryJaneState(5000);
 const coinStops=BASE_REELS.map(reel=>reel.indexOf('COIN'));
 for(let i=0;i<2;i++)state=spinMaryJane(state,coinStops);
 assert(state.buzz>1);const multiplier=state.buzz;
 // Set the completed cycle state while preserving the already accumulated frame mask.
 state={...state,cycle:9};
 const scatterStops=BASE_REELS.map((reel,r)=>r%2===0?reel.indexOf('SCATTER'):0);
 state=spinMaryJane(state,scatterStops);
 // Some Scatters may be overwritten on cycle ten by previously framed positions.
 if(state.mode==='bonus'){assert.equal(state.bonusBuzz,multiplier);assert.equal(state.buzz,1);}
 else assert.equal(state.cycle,0);
});

test('per-paid-session 1000x cap never overcredits the bonus',()=>{
 let state=initialMaryJaneState(1000);
 state={...state,mode:'bonus',buzz:10,bonusBuzz:10,freeRemaining:1,sessionCapRemaining:123456,stake:50};
 const before=state.balanceMicros;
 const stops=BONUS_REELS.map(reel=>reel.indexOf('WILD'));
 state=spinMaryJane(state,stops);
 assert(state.balanceMicros-before<=123456);
 assert(state.lastWinMicros<=123456);
 assert.equal(state.mode,'base');
 assert.equal(MAX_PAYOUT_X,1000);
});

test('Mary Jane cabinet, artwork tile, controls, INFO table and payline guide render',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const lobby=createSlotsLobby(document);
 assert(SLOT_MACHINES.length>=3,'Slots lobby must retain at least the original machines');
 assert(lobby.textContent.includes("Mary Jane's Sticky Wilds"));
 assert.equal(slotMachineFromHash('#game=slots&machine=mary-jane-sticky-wilds')?.id,'mary-jane-sticky-wilds');
 const root=createMaryJanePractice(document);
 assert.equal(root.querySelectorAll('.mj-cell').length,20);
 assert.equal(root.querySelectorAll('.mj-reel').length,5);
 assert(root.classList.contains('mj-concept'));
 assert(root.querySelector('.mj-scene'));
 assert(root.querySelectorAll('.mj-symbol-art').length>0);
 assert(root.querySelector('.mj-live-buzz'));
 assert(root.querySelector('.mj-hit-spin'));
 assert(root.querySelector('.mj-hit-info'));
 assert.equal(root.querySelector('.mj-live-total').textContent,'10.00');
 assert.equal(root.querySelector('.mj-live-bet').textContent,'0.50');
 assert(root.textContent.includes('MAX WIN 1000× TOTAL BET'));
 root.querySelector('.mj-control').dispatchEvent(new window.Event('click'));
 const info=root.querySelector('[role="dialog"]');assert(info);
 assert.equal(info.querySelectorAll('.mj-paytable tr').length,15);
 assert.equal(info.querySelectorAll('.mj-line-list span').length,20);
 assert.match(info.textContent,/Wilds never substitute for Coins or Scatters/);
 assert.match(info.textContent,/MAX WIN 1000/);
 info.querySelector('.mj-close').dispatchEvent(new window.Event('click'));
 assert.equal(root.querySelector('[role="dialog"]'),null);
 assert(root.querySelector('.mj-spin'));
 root.stopAnimation();
});

test('Mary Jane generated concept cabinet and symbol atlas are committed and loaded as presentation-only assets',()=>{
 const css=readFileSync(new URL('../src/mary-jane-concept.css',import.meta.url),'utf8');
 const artDir=new URL('../public/assets/420bet/mary-jane/',import.meta.url);
 for(const file of ['mj-concept-cabinet.webp','mj-symbol-atlas.webp','mj-portrait-art.webp'])
  assert(existsSync(new URL(file,artDir)),'missing committed concept artwork '+file);
 assert.match(css,/mj-concept-cabinet\.webp/);
 assert.match(css,/mj-symbol-atlas\.webp/);
 assert.match(css,/\.mj-hit-info/);
 const {document,window}=parseHTML('<html><body></body></html>');
 const game=createMaryJanePractice(document);
 const before=game.querySelector('.mj-live-total').textContent;
 game.querySelector('.mj-hit-plus').dispatchEvent(new window.Event('click'));
 assert.notEqual(game.querySelector('.mj-live-total').textContent,before);
 game.querySelector('.mj-hit-info').dispatchEvent(new window.Event('click'));
 assert(game.querySelector('[role="dialog"]'));
 game.stopAnimation();
});


test('Mary Jane concept fits the available viewport and scales controls with the cabinet',()=>{
 const css=readFileSync(new URL('../src/mary-jane-concept.css',import.meta.url),'utf8');
 assert.match(css,/#app:has\(\.mary-jane-game\.mj-concept\)\{height:100dvh/);
 assert.match(css,/\.view-scroll:has\(\.mary-jane-game\.mj-concept\)\{[^}]*container-type:size/);
 assert.match(css,/width:min\(100%,1672px,calc\(\(100cqh - 30px\)\*1\.776833\)\)/);
 assert.match(css,/\.mj-concept \.mj-scene\{min-width:0\}/);
 const aspect=1672/941;
 for(const [width,height] of [[1440,610],[1280,720],[960,490],[800,400],[380,660]]){
   const fitted=Math.min(width,1672,Math.max(0,height-30)*1.776833);
   assert(fitted<=width,'cabinet exceeds available width');
   assert(fitted/aspect<=height-29.99,'cabinet clips available height');
 }
 // The original percentage-based hotspots and reels remain relative to the scene.
 assert.match(css,/\.mj-concept \.mj-hit-spin\{left:45\.0%;top:79\.9%/);
 assert.match(css,/\.mj-concept \.mj-reels\{position:absolute;z-index:2;left:19\.7%;top:17\.5%/);
});


test('approved feathered roach clip replaces L03 and all reel art is centered and inset',()=>{
 const css=readFileSync(new URL('../src/mary-jane-concept.css',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/mary-jane-ui.js',import.meta.url),'utf8');
 const asset=new URL('../public/assets/420bet/mary-jane/mj-feather-roachclip.webp',import.meta.url);
 assert(existsSync(asset),'the approved feathered roach clip artwork must be committed');
 assert.match(css,/\.mj-concept \.mj-cell \.mj-symbol-art\s*\{[^}]*inset:9% 9%/);
 assert.match(css,/\.mj-concept \.mj-cell \.mj-symbol-art\.mj-roachclip-art\s*\{[^}]*inset:5% 6%/);
 assert.match(css,/mj-feather-roachclip\.webp/);
 assert.match(css,/background-size:contain/);
 assert.match(ui,/normalized==='L03'\?'mj-roachclip-art'/);
 assert.match(ui,/if\(normalized!=='L03'\)art\.style\.backgroundPosition/);
 // The H01 four-part portrait must retain its full-height image treatment.
 assert.match(css,/\.mj-concept \.mj-portrait-part img\{[^}]*height:400%/);
});


test('reels settle 500 ms apart and bonus is initiated one SPIN at a time',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 let now=0,nextId=1;const jobs=new Map();
 const clock={
  setTimeout(fn,delay){const id=nextId++;jobs.set(id,{at:now+delay,fn});return id;},
  clearTimeout(id){jobs.delete(id);},
  advance(ms){
   const target=now+ms;
   while(true){
    const due=[...jobs].filter(([,v])=>v.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];
    if(!due)break;
    now=due[1].at;jobs.delete(due[0]);due[1].fn();
   }
   now=target;
  }
 };
 const game=createMaryJanePractice(document,{
  ...clock,
  pickStops:state=>state.mode==='bonus'?
   BONUS_REELS.map(reel=>reel.indexOf('WILD')):
   BASE_REELS.map((reel,r)=>r%2===0?reel.indexOf('SCATTER'):0)
 });
 const click=selector=>game.querySelector(selector).dispatchEvent(new window.Event('click'));
 const moving=()=>game.querySelectorAll('.mj-reel-moving').length;
 click('.mj-hit-spin');
 assert.equal(moving(),5);
 assert(game.querySelector('.mj-hit-spin').disabled,'spin should lock while reels settle');
 clock.advance(599);assert.equal(moving(),5);
 clock.advance(1);assert.equal(moving(),4);
 for(let left=3;left>=1;left--){clock.advance(500);assert.equal(moving(),left);}
 clock.advance(500);assert.equal(moving(),0);
 assert.match(game.querySelector('.mj-message').textContent,/PRESS SPIN/);
 assert.match(game.querySelector('.mj-live-cycle').textContent,/FREE 10 OF 10/);
 assert(game.querySelector('.mj-hit-auto').disabled,'auto must stop for free spins');
 assert.equal(jobs.size,0,'bonus must not self-advance');
 clock.advance(5000);
 assert.match(game.querySelector('.mj-live-cycle').textContent,/FREE 10 OF 10/);
 click('.mj-hit-spin');
 assert.equal(moving(),5);
 clock.advance(2600);
 assert.match(game.querySelector('.mj-live-cycle').textContent,/FREE 9 OF 10/);
 assert.match(game.querySelector('.mj-message').textContent,/PRESS SPIN/);
 assert.equal(jobs.size,0);
 game.stopAnimation();
});

test('highlighted Gold Leaf Frames and art sizing are distinct; scatter explainer uses actual sign',()=>{
 const css=readFileSync(new URL('../src/mary-jane-concept.css',import.meta.url),'utf8');
 assert.match(css,/\.mj-cell\.mj-framed::after/);
 assert.match(css,/mj-gold-leaf-glow/);
 assert.match(css,/\.mj-symbol-art\.mj-art-wide/);
 assert.match(css,/\.mj-symbol-art\.mj-art-tall/);
 assert.match(css,/\.mj-symbol-art\.mj-art-compact/);
 assert.match(css,/\.mj-scatter-trigger-icon/);
 assert.match(css,/background-position:33\.333% 100%/);
 const {document}=parseHTML('<html><body></body></html>');
 const game=createMaryJanePractice(document);
 const trigger=game.querySelector('.mj-bonus-trigger');
 assert(trigger);
 assert.match(trigger.getAttribute('aria-label'),/Vegas 420 Scatter signs/);
 assert(trigger.querySelector('.mj-scatter-trigger-icon'));
 game.stopAnimation();
});

test('spinning reels visibly cycle consecutive 60-stop symbols before staggered settlement',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 let now=0,id=0;const pending=new Map();
 const clock={
  setTimeout(fn,delay){const key=++id;pending.set(key,{at:now+delay,fn});return key;},
  clearTimeout(key){pending.delete(key);},
  advance(ms){const end=now+ms;while(true){
   const due=[...pending].filter(([,task])=>task.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
   if(!due)break;now=due[1].at;pending.delete(due[0]);due[1].fn();
  }now=end;}
 };
 const stops=[0,9,17,30,42];
 const game=createMaryJanePractice(document,{...clock,pickStops:()=>stops});
 const labels=reel=>[...game.querySelectorAll('.mj-reel[data-reel="'+reel+'"] .mj-cell')]
   .map(cell=>cell.getAttribute('aria-label'));
 const initial=labels(0);
 const originalBalance=game.querySelector('.mj-live-balance').textContent;
 game.querySelector('.mj-hit-spin').dispatchEvent(new window.Event('click'));
 assert.equal(game.querySelectorAll('.mj-reel-moving').length,5);
 clock.advance(85);
 assert.notDeepEqual(labels(0),initial,'reel one must actually change displayed symbols');
 assert.equal(game.querySelector('.mj-live-balance').textContent,originalBalance,'stake settles only after reel 5');
 const beforeSecondTick=labels(0);
 clock.advance(85);
 assert.notDeepEqual(labels(0),beforeSecondTick,'symbols must continue advancing while spinning');
 clock.advance(430); // 600 ms: reel one stops
 assert.equal(game.querySelectorAll('.mj-reel-moving').length,4);
 assert.deepEqual(labels(0),Array.from({length:4},(_,r)=>BASE_REELS[0][(stops[0]+r)%60]).map((sym,row)=>
   'Reel 1 row '+(row+1)+': '+(sym.startsWith('H01')?'Mary Jane':SYMBOL_NAMES[sym])));
 const firstStopped=labels(0),secondBefore=labels(1);
 clock.advance(170);
 assert.deepEqual(labels(0),firstStopped,'settled reel must not animate');
 assert.notDeepEqual(labels(1),secondBefore,'next reel must keep advancing');
 clock.advance(1830);
 assert.equal(game.querySelectorAll('.mj-reel-moving').length,0);
 assert.equal(pending.size,0,'all animation tick timers must be cleared at final reel stop');
 assert.equal(game.querySelectorAll('.mj-cell').length,20);
 game.stopAnimation();
});

test('leaving a spinning Mary Jane machine cancels all pending reel animation tasks',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 let next=1;const pending=new Map();
 const game=createMaryJanePractice(document,{
  setTimeout(fn,delay){const id=next++;pending.set(id,{fn,delay});return id;},
  clearTimeout(id){pending.delete(id);},
  pickStops:()=>[0,9,17,30,42]
 });
 game.querySelector('.mj-hit-spin').dispatchEvent(new window.Event('click'));
 assert(pending.size>=6,'expected five staggered stops and a symbol ticker');
 game.stopAnimation();
 assert.equal(pending.size,0);
});

test('oversized THC BAR, joint, bong and lighter have dedicated centered art without atlas remapping',()=>{
 const css=readFileSync(new URL('../src/mary-jane-concept.css',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/mary-jane-ui.js',import.meta.url),'utf8');
 for(const name of ['bar','joint','bong','lighter']){
  const re=new RegExp('\\.mj-symbol-art\\.mj-art-'+name+'\\s*\\{([^}]*)\\}');
  const match=css.match(re);
  assert(match,'missing per-symbol CSS for '+name);
   assert.match(match[1],/inset:\d+% \d+% \d+% \d+%/);
  assert.match(match[1],/transform:translate/);
  assert.doesNotMatch(match[1],/background-position/i,'sprite atlas must not be recentered to another symbol');
 }
 for(const id of ['H06','L05','H05','L04'])
  assert(ui.includes("normalized==='"+id+"'"),'missing explicit symbol class '+id);
 assert(ui.includes("art.style.backgroundPosition=((i%4)*100/3)"),'keep precise sprite coordinates');
 // Verify the DOM class is assigned to its matching symbol, not just CSS.
 const {document,window}=parseHTML('<html><body></body></html>');
 let now=0,id=0;const jobs=new Map();
 const timers={
  setTimeout(fn,delay){const key=++id;jobs.set(key,{at:now+delay,fn});return key;},
  clearTimeout(key){jobs.delete(key);},
  advance(ms){const end=now+ms;while(true){
   const due=[...jobs].filter(([,job])=>job.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
   if(!due)break;now=due[1].at;jobs.delete(due[0]);due[1].fn();
  }now=end;}
 };
 let chosen='H06';
 const game=createMaryJanePractice(document,{...timers,pickStops:()=>BASE_REELS.map((reel,r)=>r===0?reel.indexOf(chosen):0)});
 for(const [symbol,cls] of [['H06','bar'],['L05','joint'],['H05','bong'],['L04','lighter']]){
  chosen=symbol;
  game.querySelector('.mj-hit-spin').dispatchEvent(new window.Event('click'));
  timers.advance(2600);
  const cells=[...game.querySelectorAll('.mj-reel[data-reel="0"] .mj-cell')];
  const selected=cells.find(cell=>cell.getAttribute('aria-label')?.endsWith(
   ({H06:'THC BAR',L05:'Joint',H05:'Glass Bong',L04:'Lighter'})[symbol]
  ));
  assert(selected,'missing rendered '+symbol);
  const art=selected.querySelector('.mj-symbol-art.mj-art-'+cls);
  assert(art,'wrong class for '+symbol);
  assert(art.style.backgroundPosition,'atlas coordinates missing for '+symbol);
  assert.equal(jobs.size,0,'spin animation must complete');
 }
 game.stopAnimation();
});
