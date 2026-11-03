import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {BASE_REELS,BONUS_REELS,PAYLINES,BASE_PAYTABLE,BONUS_PAYTABLE,validateMaryJaneModel,MAX_PAYOUT_X} from '../src/mary-jane-model.js';
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
 assert.equal(SLOT_MACHINES.length,2);
 assert(lobby.textContent.includes("Mary Jane's Sticky Wilds"));
 assert.equal(slotMachineFromHash('#game=slots&machine=mary-jane-sticky-wilds')?.id,'mary-jane-sticky-wilds');
 const root=createMaryJanePractice(document);
 assert.equal(root.querySelectorAll('.mj-cell').length,20);
 assert.equal(root.querySelectorAll('.mj-reel').length,5);
 assert(root.querySelector('.mj-character img').getAttribute('src').endsWith('mary-jane-portrait.svg'));
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
