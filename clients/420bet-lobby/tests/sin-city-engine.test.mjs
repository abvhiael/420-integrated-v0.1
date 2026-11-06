import test from 'node:test';
import assert from 'node:assert/strict';
import {BASE_STRIPS,FREE_STRIPS,STRIP_LENGTH,ROWS,REELS,initialState,nextRound,visibleBoard,awardFreeSpins,waysWins,puffPuffPass,MAX_MULTIPLIER} from '../src/sin-city-engine.js';

test('all five circular reels contain 42 entries and never show duplicate scatters in the same four-high window',()=>{
 for(const strips of [BASE_STRIPS,FREE_STRIPS])for(const strip of strips){
  assert.equal(strip.length,STRIP_LENGTH);
  for(let stop=0;stop<STRIP_LENGTH;stop++){
   assert.ok(Array.from({length:ROWS},(_,r)=>strip[(stop+r)%STRIP_LENGTH]).filter(s=>s==='SCATTER').length<=1);
  }
 }
});
test('visible grid is strictly five columns by four rows',()=>{
 const board=visibleBoard(BASE_STRIPS,[0,1,2,3,4]);assert.equal(board.length,REELS);
 assert.ok(board.every(reel=>reel.length===ROWS));
});
test('five matching columns produce 1,024 ways, left to right',()=>{
 const board=Array.from({length:5},()=>Array(4).fill('BUD'));
 const result=waysWins(board,1),bud=result.wins.find(w=>w.symbol==='BUD');
 assert.equal(bud.ways,1024);assert.equal(bud.length,5);
 assert.equal(bud.amount,1024*.8);
});
test('scatter bonus awards 8, 12 and 20 for three to five independent reels',()=>{
 for(const [n,award] of [[2,0],[3,8],[4,12],[5,20]]){
  const board=Array.from({length:5},(_,r)=>[r<n?'SCATTER':'BUD','BUD','J','K']);
  assert.equal(awardFreeSpins(board),award);
 }
});
test('puff changes only eligible positions without touching scatters or gems',()=>{
 const board=[['ASH','SCATTER','GEM','BUD'],['ASH','BUD','J','K'],['ASH','Q','J','K'],['A','Q','J','K'],['A','Q','J','K']];
 const before=structuredClone(board),result=puffPuffPass(board,()=>0);
 assert.equal(result.changed.length,3);assert.equal(result.board[0][1],'SCATTER');
 assert.equal(result.board[0][2],'GEM');assert.deepEqual(board,before);
});
test('practice play debits only simulated credits and respects global maximum',()=>{
 let state=initialState();assert.equal(state.balance,1000);
 const before=state.balance;state=nextRound(state,()=>.4,[1,3,5,7,9]);
 assert.equal(state.balance,Math.round((before-state.stake+state.lastWin)*100)/100);
 assert.ok(state.roundGross<=state.roundStake*MAX_MULTIPLIER);
 assert.ok(state.lastWin>=0);assert.ok(state.lastBoard.length===5);
});
test('no funds can be spent when practice credits are exhausted',()=>{
 const empty={...initialState(),balance:0};const after=nextRound(empty,()=>0);
 assert.equal(after.balance,0);assert.equal(after.lastMessage,'NOT ENOUGH PRACTICE CREDITS');
});

test('pure Wild ways are awarded once rather than for every paying symbol',()=>{
 const board=Array.from({length:5},()=>['WILD','WILD','WILD','WILD']);
 const r=waysWins(board,1);
 assert.equal(r.wins.length,1);
 assert.equal(r.wins[0].symbol,'WILD');
 assert.equal(r.wins[0].ways,1024);
 assert.equal(r.total,4300.8);
});
test('Hotbox carries all trigger gems into the first respin',()=>{
 const strips=BASE_STRIPS;
 const stops=strips.map(strip=>{
  for(let i=0;i<strip.length;i++)if(Array.from({length:4},(_,j)=>strip[(i+j)%strip.length]).includes('GEM'))return i;
  throw new Error('No GEM on reel');
 });
 const state=nextRound(initialState(),()=>.3,stops);
 assert.equal(state.mode,'hotbox');assert.ok(state.locked.length>=3);
 for(const index of state.locked){
  const r=Math.floor(index/4),row=index%4;
  assert.equal(state.lastBoard[r][row],'GEM');
 }
 const follow=nextRound(state,()=>0,Array(5).fill(0));
 assert.ok(follow.locked.length>=state.locked.length || follow.mode==='base');
});
test('free spin transition preserves balance without debit and decreases remaining spins',()=>{
 const strips=BASE_STRIPS;
 const stops=strips.map(strip=>strip.indexOf('SCATTER'));
 const first=nextRound(initialState(),()=>.33,stops);
 assert.equal(first.mode,'free');assert.equal(first.freeRemaining,20);
 const before=first.balance;const after=nextRound(first,()=>.33,Array(5).fill(0));
 assert.equal(after.freeRemaining,19);
 assert.equal(after.balance,Math.round((before+after.lastWin)*100)/100);
});
