import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {LINES,ART,JARS,PAY,BASE_POOL,FREE_POOL,FREE_UPGRADES,spinBoard,evaluate,createRacketsTrashStash,MAX_WIN,awardWildRetriggers,WILDS_PER_RETRIGGER,SPINS_PER_RETRIGGER,MAX_RETRIGGER_SPINS,MAX_RETRIGGERS} from '../src/rackets-trash-stash.js';

test('Racket has 20 valid complete payline paths and all uploaded reel art',()=>{
 assert.equal(LINES.length,20);
 for(const line of LINES){assert.equal(line.length,5);assert.ok(line.every(y=>Number.isInteger(y)&&y>=0&&y<3));}
 for(const key of ['RACKET','WILD','BONUS','BLUE05','BLUE075','PURPLE1','PURPLE15','RED25','RED5','TRASH','PIZZA','LIGHTER','GLOVE','SEEDS','BINOCULARS','COOLER','MUSHROOM','A','K','Q','J','TEN','NINE'])assert.ok(ART[key],key);
 assert.deepEqual(Object.values(JARS),[.5,.75,1,1.5,2.5,5]);
});
test('Base has six Wild weights, Free Spins have three, and Bonus is limited to one per reel',()=>{
 assert.equal(BASE_POOL.filter(x=>x==='WILD').length,6);
 assert.equal(FREE_POOL.filter(x=>x==='WILD').length,3);
 assert.equal(BASE_POOL.filter(x=>x==='BONUS').length,1);
 assert.equal(FREE_POOL.filter(x=>x==='BONUS').length,0);
 const board=spinBoard('base',()=>.999);
 assert.equal(board.length,5);
 for(const reel of board){assert.equal(reel.length,3);assert.ok(reel.filter(x=>x==='BONUS').length<=1);assert.ok(reel.every(x=>x==='WILD'));}
 const wildBoard=Array.from({length:5},()=>['TRASH','PIZZA','SEEDS']);
 wildBoard[0][0]='WILD';wildBoard[1][0]='RACKET';wildBoard[2][0]='RACKET';
 const win=evaluate(wildBoard,1,'base');
 assert.ok(win.wins.some(w=>w.kind==='match'&&w.name==='RACKET'));
 assert.equal(win.collection,0,'base Wilds substitute but never collect jars');
});
test('Three separate bonus reels award ten spins, and jar prizes pay their sum',()=>{
 const board=Array.from({length:5},()=>['A','K','Q']);
 board[0][0]='BONUS';board[1][2]='BONUS';board[2][1]='BONUS';
 assert.equal(evaluate(board,2).trigger,10);
 board[3][1]='BONUS';assert.equal(evaluate(board,2).trigger,15);
 board[4][1]='BONUS';assert.equal(evaluate(board,2).trigger,20);
 const jars=Array.from({length:5},()=>['Q','A','J']);
 jars[0][0]='BLUE05';jars[1][0]='PURPLE1';jars[2][0]='RED25';
 const result=evaluate(jars,2);
 assert.ok(result.wins.some(w=>w.kind==='prize'&&w.line===2&&w.amount===8));
});
test('Winning Wilds collect prize jars on reels 2 through 5 in free spins',()=>{
 const board=Array.from({length:5},()=>['Q','Q','Q']);
 board[0][0]='WILD';board[1][0]='RACKET';board[2][0]='RACKET';
 board[1][2]='BLUE075';board[2][2]='PURPLE15';board[3][2]='RED5';
 const result=evaluate(board,2,'free',3);
 assert.ok(result.qualifyingWilds>=1);
 assert.ok(result.collection>=(.75+1.5+5)*2*3);
 assert.ok(result.total<=MAX_WIN*2);
});
test('Racket game renders independent 5x3 reels, payout panel, bonus triggers, info and back button',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createRacketsTrashStash(document,{rng:()=>.34});
 assert.equal(root.dataset.practiceGame,'rackets-trash-stash');
 assert.equal(root.querySelectorAll('.rts-reel').length,5);
 assert.equal(root.querySelectorAll('.rts-cell img').length,15);
 assert.equal(root.querySelectorAll('.rts-payout-table tr').length,1+Object.keys(PAY).length);
 assert.match(root.textContent,/BONUS TRIGGERS/);
 const info=[...root.querySelectorAll('button')].find(x=>x.textContent==='INFO');
 info.dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(root.querySelectorAll('.rts-payline-mini').length,20);
 assert.match(root.textContent,/BACK TO GAME/);
 root.querySelector('.rts-back').dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(root.querySelectorAll('.rts-reel').length,5);
 root.stopAnimation();
});

test('Bonus Tests exposes all seven feature scenarios and three bonus symbols start 10 free spins without debit',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createRacketsTrashStash(document,{rng:()=>.35});
 const tap=(label)=>{const b=[...root.querySelectorAll('button')].find(x=>x.textContent.trim()===label);assert.ok(b,label);b.dispatchEvent(new window.Event('click',{bubbles:true}));};
 const initial=root.getGameState().balance;
 tap('BONUS TESTS');
 assert.equal(root.querySelectorAll('.rts-test-choice').length,9);
 tap('3 BONUS · 10 FREE SPINS');
 const state=root.getGameState();
 assert.equal(state.freeLeft,10);
 assert.equal(state.balance,initial);
 assert.equal(state.testScenario,'three');
 assert.equal(state.board.filter(reel=>reel.includes('BONUS')).length,3);
 root.stopAnimation();
});
test('Bonus Tests can select multiplier tiers and prize-collection demo',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createRacketsTrashStash(document,{rng:()=>.35});
 const tap=(label)=>{const b=[...root.querySelectorAll('button')].find(x=>x.textContent.trim()===label);assert.ok(b,label);b.dispatchEvent(new window.Event('click',{bubbles:true}));};
 tap('BONUS TESTS');tap('RETRIGGER 3 · ×10');
 assert.equal(root.getGameState().multiplier,10);
 assert.equal(root.getGameState().retriggers,3);
 assert.equal(root.getGameState().freeLeft,5);
 root.stopAnimation();
 const root2=createRacketsTrashStash(document,{rng:()=>.35});
 const tap2=(label)=>{const b=[...root2.querySelectorAll('button')].find(x=>x.textContent.trim()===label);assert.ok(b,label);b.dispatchEvent(new window.Event('click',{bubbles:true}));};
 tap2('BONUS TESTS');tap2('WILD PRIZE COLLECTION');
 assert.equal(root2.getGameState().testScenario,'collection');
 assert.equal(root2.getGameState().freeLeft,10);
 root2.stopAnimation();
});

test('Staggered reel stops reveal the new outcome immediately, with no final board jump',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const jobs=new Map();let serial=0;
 const clock={setTimeout(fn){const id=++serial;jobs.set(id,fn);return id;},clearTimeout(id){jobs.delete(id);}};
 const tick=()=>{const [id,fn]=jobs.entries().next().value??[];assert.ok(fn,'expected queued reel stop');jobs.delete(id);fn();};
 let draw=0;
 const rng=()=>{draw++;return draw<=15?0:.91;};
 const root=createRacketsTrashStash(document,{rng,clock});
 const before=root.getGameState().display.map(reel=>[...reel]);
 const spin=[...root.querySelectorAll('button')].find(b=>b.textContent==='SPIN');
 assert.ok(spin);spin.dispatchEvent(new window.Event('click',{bubbles:true}));
 let state=root.getGameState();
 assert.equal(state.phase,'spinning');
 const target=state.pendingBoard.map(reel=>[...reel]);
 assert.notDeepEqual(target,before);
 for(let r=0;r<4;r++){
  tick();state=root.getGameState();
  assert.equal(state.stopped,r+1);
  assert.equal(state.phase,'spinning');
  assert.deepEqual(state.display.slice(0,r+1),target.slice(0,r+1),'stopped reels must show their target');
  assert.deepEqual(state.display.slice(r+1),before.slice(r+1),'still-spinning reels remain obscured');
  assert.equal(root.querySelectorAll('.rts-spinning').length,4-r);
  assert.equal(root.querySelector('.rts-reel:not(.rts-spinning) img').getAttribute('src').endsWith(ART[target[0][0]]),true);
 }
 tick();state=root.getGameState();
 assert.equal(state.stopped,5);
 assert.deepEqual(state.board,target);
 assert.deepEqual(state.display,target);
 assert.equal(state.pendingBoard,null);
 assert.equal(root.querySelectorAll('.rts-spinning').length,0);
 root.stopAnimation();
});

test('Approved Racket logo replaces the text title and the moonlit wallpaper is configured',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const root=createRacketsTrashStash(document,{rng:()=>.32});
 const logo=root.querySelector('.rts-title-logo');
 assert.ok(logo);
 assert.equal(logo.getAttribute('src'),'/assets/420bet/slots/rackets-trash-stash/ui/rackets-trash-stash-logo.png');
 assert.equal(root.querySelector('.rts-header h1').textContent,'');
 const css=readFileSync(new URL('../src/rackets-trash-stash.css',import.meta.url),'utf8');
 assert.ok(css.includes('/assets/420bet/slots/rackets-trash-stash/backgrounds/rackets-trash-stash-wallpaper.png'));
 assert.match(css,/\.rts-title-logo\{/);
 assert.equal(root.querySelectorAll('.rts-reel').length,5);
 assert.match(root.textContent,/BONUS TRIGGERS/);
 root.stopAnimation();
});

test('Every low-paying symbol is replaced by its specified premium symbol in Free Spins',()=>{
 assert.deepEqual(FREE_UPGRADES,{A:'TRASH',K:'PIZZA',Q:'LIGHTER',J:'SEEDS',TEN:'COOLER',NINE:'MUSHROOM'});
 for(const low of Object.keys(FREE_UPGRADES))assert.equal(FREE_POOL.includes(low),false,low+' must never appear during Free Spins');
 for(const upgraded of Object.values(FREE_UPGRADES))assert.ok(FREE_POOL.includes(upgraded));
 assert.equal(FREE_POOL.length,48);
 assert.equal(BASE_POOL.length,54);
 assert.equal(BASE_POOL.filter(x=>x.startsWith('BLUE')).length,4);
 assert.equal(BASE_POOL.filter(x=>x==='RED5').length,1);
 const freeSpin=spinBoard('free',()=>.7);
 assert.ok(freeSpin.flat().every(x=>!Object.hasOwn(FREE_UPGRADES,x)));
});

test('Recalibrated ordinary paytable preserves premium and low tiers',()=>{
 assert.deepEqual(PAY.RACKET,[28,140,700]);
 assert.deepEqual(PAY.TRASH,[11.2,35,168]);
 assert.deepEqual(PAY.A,[1.75,4.2,17.5]);
 assert.ok(PAY.RACKET[0]>PAY.TRASH[0]);
 assert.ok(PAY.TRASH[0]>PAY.A[0]);
});

test('Every fifth winning Wild awards five more spins, never more than 25 extra',()=>{
 assert.equal(WILDS_PER_RETRIGGER,5);
 assert.equal(SPINS_PER_RETRIGGER,5);
 assert.equal(MAX_RETRIGGER_SPINS,25);
 assert.equal(MAX_RETRIGGERS,5);
 assert.deepEqual(awardWildRetriggers(0,0,4),{progress:4,retriggers:0,awardedSpins:0,multiplier:1});
 assert.deepEqual(awardWildRetriggers(4,0,1),{progress:0,retriggers:1,awardedSpins:5,multiplier:2});
 assert.deepEqual(awardWildRetriggers(3,1,7),{progress:0,retriggers:3,awardedSpins:10,multiplier:10});
 assert.deepEqual(awardWildRetriggers(0,3,10),{progress:0,retriggers:5,awardedSpins:10,multiplier:10});
 assert.deepEqual(awardWildRetriggers(0,4,55),{progress:0,retriggers:5,awardedSpins:5,multiplier:10});
 assert.deepEqual(awardWildRetriggers(0,5,55),{progress:0,retriggers:5,awardedSpins:0,multiplier:10});
 let progress=0,retriggers=0,awarded=0;
 for(let i=0;i<100;i++){
  const result=awardWildRetriggers(progress,retriggers,1);
  progress=result.progress;retriggers=result.retriggers;awarded+=result.awardedSpins;
 }
 assert.equal(awarded,25);
 assert.equal(retriggers,5);
});
test('Bonus Tests includes fourth and fifth retrigger tier, both at 5 spins and ×10',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 for(const [label,tier] of [['RETRIGGER 4 · ×10',4],['RETRIGGER 5 · ×10',5]]){
  const root=createRacketsTrashStash(document,{rng:()=>.35});
  const tap=(name)=>{const b=[...root.querySelectorAll('button')].find(x=>x.textContent.trim()===name);assert.ok(b,name);b.dispatchEvent(new window.Event('click',{bubbles:true}));};
  tap('BONUS TESTS');tap(label);
  const state=root.getGameState();
  assert.equal(state.retriggers,tier);
  assert.equal(state.multiplier,10);
  assert.equal(state.freeLeft,5);
  assert.match(root.textContent,/WILD PROGRESS 0\/5/);
  root.stopAnimation();
 }
});
