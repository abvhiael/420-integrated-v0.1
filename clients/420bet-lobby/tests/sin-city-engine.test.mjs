import test from 'node:test';
import assert from 'node:assert/strict';
import {BASE_STRIPS,FREE_STRIPS,STRIP_LENGTH,ROWS,REELS,initialState,nextRound,visibleBoard,awardFreeSpins,waysWins,puffPuffPass,MAX_MULTIPLIER,HOTBOX_PAYS,hotboxPayout,count,PAYTABLE,FREE_PAYTABLE,BASE_WAYS_SCALE,FREE_WAYS_SCALE} from '../src/sin-city-engine.js';

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
 assert.equal(bud.amount,Math.round(1024*PAYTABLE.BUD[2]*100)/100);
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
 assert.equal(r.total,Math.round(1024*PAYTABLE.BOBBY[2]*100)/100);
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

test('Hotbox respins retain ordinary symbol artwork beside locked gems',()=>{
 const stops=BASE_STRIPS.map(strip=>strip.findIndex((symbol,i)=>symbol==='GEM'));
 const triggered=nextRound(initialState(),()=>.33,stops);
 assert.equal(triggered.mode,'hotbox');
 const result=nextRound(triggered,()=>.21,[0,5,10,15,20]);
 assert.equal(result.lastBoard.flat().length,20);
 assert.ok(result.lastBoard.flat().every(symbol=>symbol!==''),'no symbol becomes a blank placeholder');
 assert.ok(result.lastBoard.flat().some(symbol=>symbol!=='GEM'),'ordinary symbols remain visible');
});
test('every new Wild sticks and all earlier Wilds persist through subsequent free spins',()=>{
 const picks=FREE_STRIPS.map(strip=>strip.findIndex(symbol=>symbol==='WILD'));
 assert.ok(picks.every(stop=>stop>=0));
 let state={...initialState(),mode:'free',freeRemaining:20,freePlayed:0};
 state=nextRound(state,()=>.3,picks);
 assert.ok(state.sticky.length>=5,'Wilds from every reel should accumulate on first free spin');
 const original=[...state.sticky];
 const more=FREE_STRIPS.map((strip,r)=>((picks[r]+20)%strip.length));
 for(let i=0;i<3;i++){
  state=nextRound(state,()=>.3,more);
  for(const key of original){
   assert.ok(state.sticky.includes(key),'Earlier sticky Wild has been lost');
   const r=Math.floor(key/4),row=key%4;
   assert.equal(state.lastBoard[r][row],'WILD','Earlier Wild must stay visible in its original position');
   assert.equal(state.lastReveal.before[r][row],'WILD','Held Wild must be present before reel stop');
  }
 }
 assert.ok(state.sticky.length<=20);
});
test('Chronic Sessions starting awards and retriggers expose exact quantities',()=>{
 const stops=BASE_STRIPS.map((strip,r)=>r<3?strip.indexOf('SCATTER'):0);
 const state=nextRound(initialState(),()=>.11,stops);
 assert.equal(state.lastAwardedSpins,8);
 assert.equal(state.freeRemaining,8);
 assert.match(state.lastMessage,/8 FREE SPINS AWARDED/);
});
test('Lowrider practice fixture never accidentally retriggers Chronic Sessions',async()=>{
 const {makeSinCityBonusPreview}=await import('../src/sin-city-bonus-preview.js');
 const fixture=makeSinCityBonusPreview('lowrider');
 const state=nextRound(fixture.state,()=>.3,fixture.stops);
 assert.equal(state.lastFeature,'lowrider');
 assert.equal(state.lastRetriggeredSpins,0);
 assert.equal(state.freeRemaining,2);
 assert.match(state.lastMessage,/LOWRIDER ×/);
});

test('Hotbox payout ladder increases monotonically and pays at the end of respins',()=>{
 for(let gems=3;gems<20;gems++){
  assert.ok(HOTBOX_PAYS[gems]>0);
  assert.ok(HOTBOX_PAYS[gems+1]>HOTBOX_PAYS[gems]);
 }
 assert.equal(hotboxPayout(3,2),.4);
 assert.equal(hotboxPayout(10,2),4.8);
 assert.equal(hotboxPayout(20,2),200);
 const state={...initialState(),mode:'hotbox',locked:[0,4,8,12,16],respins:1,roundStake:2};
 const stops=BASE_STRIPS.map(strip=>strip.findIndex((v,i)=>!Array.from({length:4},(_,j)=>strip[(i+j)%42]).includes('GEM')));
 const result=nextRound(state,()=>.42,stops);
 assert.equal(result.mode,'base');
 assert.equal(result.lastWin,hotboxPayout(5,2));
});
test('previously locked Hotbox gems stay in before/after reel frames',()=>{
 const state={...initialState(),mode:'hotbox',locked:[0,2,7,12],respins:3};
 const out=nextRound(state,()=>.4,[0,3,6,9,12]);
 for(const key of state.locked){
  const r=Math.floor(key/4),row=key%4;
  assert.equal(out.lastReveal.before[r][row],'GEM');
  assert.equal(out.lastReveal.after[r][row],'GEM');
 }
});
test('one Lowrider triggers a multiplier, while zero Lowriders do not',()=>{
 const picks=FREE_STRIPS.map((strip,r)=>{
  for(let stop=0;stop<42;stop++){
   const visible=Array.from({length:4},(_,j)=>strip[(stop+j)%42]);
   if(r===0?visible.includes('CAR'):!visible.includes('CAR'))return stop;
  }
  throw Error('Missing selective fixture');
 });
 const board=visibleBoard(FREE_STRIPS,picks);
 assert.equal(count(board,'CAR')>=1,true);
 const one=nextRound({...initialState(),mode:'free',freeRemaining:5},()=>.1,picks);
 assert.equal(one.lastFeature,'lowrider');
 assert.equal(one.lastMultiplier,2);
 const absent=picks.map((stop,r)=>r===0?FREE_STRIPS[r].findIndex((x,i)=>!Array.from({length:4},(_,j)=>FREE_STRIPS[r][(i+j)%42]).includes('CAR')):stop);
 const none=nextRound({...initialState(),mode:'free',freeRemaining:5},()=>.1,absent);
 assert.equal(none.lastMultiplier,1);
});

test('calibrated paytables are explicit and free-spin ways are not silently using base payouts',()=>{
 assert.equal(BASE_WAYS_SCALE,.322);
 assert.equal(FREE_WAYS_SCALE,.075);
 assert.ok(FREE_PAYTABLE.BOBBY[2]<PAYTABLE.BOBBY[2]);
 const board=Array.from({length:5},()=>Array(4).fill('BUD'));
 const base=waysWins(board,2,PAYTABLE);
 const free=waysWins(board,2,FREE_PAYTABLE);
 assert.ok(free.total<base.total);
 assert.ok(base.total>0&&free.total>0);
});
test('calibrated strip frequency preserves three-gem entry while reducing natural gem density',()=>{
 const gems=BASE_STRIPS.map(strip=>strip.filter(symbol=>symbol==='GEM').length);
 assert.deepEqual(gems,[1,2,2,2,2]);
 const stops=BASE_STRIPS.map(strip=>strip.findIndex(s=>s==='GEM'));
 const triggering=nextRound(initialState(),()=>.2,stops);
 assert.equal(triggering.mode,'hotbox');
});
