import test from 'node:test';
import assert from 'node:assert/strict';
import {rank5,rank7,compareRank,settlePots,replayNLHE} from './nlhe-replay.mjs';
test('ranking straight flush, quads and ace-low wheel',()=>{
  assert.deepEqual(rank5([12,11,10,9,8]),[8,14]);
  assert.deepEqual(rank5([12,0,13,26,39]),[7,14,2]);
  assert.deepEqual(rank5([12,0,1,2,3]),[4,5]);
  assert.ok(compareRank(rank5([12,11,10,9,8]),rank5([12,0,13,26,39]))>0);
});
test('seven-card best hand evaluates independently of card order',()=>{
  const seven=[12,11,10,9,8,13,26];
  assert.deepEqual(rank7(seven),[8,14]);
  assert.deepEqual(rank7([...seven].reverse()),[8,14]);
  assert.throws(()=>rank7([1,1,2,3,4,5,6]),/invalid/);
});
test('side pot eligibility and chip conservation',()=>{
  const ranks=[[1,14,13,12,9],[2,8,7,5],[3,4,3],[4,5]];
  const {payouts,pots}=settlePots([100,200,300,300],[false,false,false,true],ranks,0);
  assert.deepEqual(pots.map(x=>x.amount),[400,300,200]);
  assert.deepEqual(payouts,[400,300,200,0]);
  assert.equal(payouts.reduce((a,b)=>a+b),900);
});
test('odd-chip split uses button-relative order',()=>{
  const rank=[2,10,7,2],weak=[1,14];
  assert.deepEqual(settlePots([5,5,5],[false,false,true],[rank,rank,weak],0).payouts,[7,8,0]);
});
test('ordered initial preflop action replay and accounting',()=>{
  const game=replayNLHE({stacks:[100,100,100],button:0,smallBlind:5,bigBlind:10,
    actions:[{nonce:1,street:0,seat:0,type:'call',amount:10},
      {nonce:2,street:0,seat:1,type:'call',amount:5},
      {nonce:3,street:0,seat:2,type:'check',amount:0}]});
  assert.deepEqual(game.contributed,[10,10,10]);
  assert.deepEqual(game.remaining,[90,90,90]);
  assert.equal(game.nonce,3);
});
test('forged calls, replay nonce, illegal turn and short raise fail closed',()=>{
  const base={stacks:[100,100,100],button:0,smallBlind:5,bigBlind:10};
  for(const action of [{nonce:2,street:0,seat:0,type:'call',amount:10},
    {nonce:1,street:0,seat:1,type:'call',amount:5},
    {nonce:1,street:0,seat:0,type:'check'},
    {nonce:1,street:0,seat:0,type:'raise',amount:11}])
    assert.throws(()=>replayNLHE({...base,actions:[action]}));
});
