import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyBettingTranscript,verifyShowdownSettlement} from './nlhe-independent-verifier.mjs';

const legal=(nonce,seat,type,amount=0)=>({
  nonce,seat,type,amount,epochCurrent:true,stateRootMatched:true,
  signed:true,signatureMatchesSeat:true,expiry:1000,timestamp:100,
});
const deal={stacks:[100,100],button:0,smallBlind:5,bigBlind:10};
test('heads-up button has small blind and first preflop action; 2 to 9 seat buttons rotate correctly',()=>{
  const two=verifyBettingTranscript({...deal,actions:[
    legal(1,0,'call',5),legal(2,1,'check')
  ]});
  assert.equal(two.phase,'AWAIT_FLOP');
  assert.deepEqual(two.seats.map(x=>x.contributed),[10,10]);
  assert.equal(two.pot,20);
  assert.equal(two.record.length,2);
  for(let n=3;n<=9;n++){
    const stack=Array(n).fill(100);
    const initial=verifyBettingTranscript({stacks:stack,button:0,smallBlind:5,bigBlind:10,actions:[]});
    assert.equal(initial.toAct,3%n);
    assert.equal(initial.seats[1].contributed,5);
    assert.equal(initial.seats[2].contributed,10);
    assert.equal(initial.pot,15);
  }
});
test('both blinds short all-in have no discretionary actor and preserve every chip',()=>{
  const game=verifyBettingTranscript({stacks:[1,2],button:0,smallBlind:5,bigBlind:10,actions:[]});
  assert.equal(game.phase,'AWAIT_FLOP');
  assert.equal(game.toAct,-1);
  assert.deepEqual(game.seats.map(p=>p.contributed),[1,2]);
  assert.equal(game.pot,3);
});
test('forged, expired, stale, wrong-turn, replay or short non-all-in actions are rejected',()=>{
  for(const event of [
    {...legal(1,0,'call',5),signed:false},
    {...legal(1,0,'call',5),signatureMatchesSeat:false},
    {...legal(1,0,'call',5),epochCurrent:false},
    {...legal(1,0,'call',5),stateRootMatched:false},
    {...legal(1,0,'call',5),expiry:10},
    legal(2,0,'call',5),
    legal(1,1,'call',5),
    legal(1,0,'check'),
    legal(1,0,'raise',6),
    legal(1,0,'raise',7),
  ])assert.throws(()=>verifyBettingTranscript({...deal,actions:[event]}));
});
test('permissionless timeout cannot advance before actual action deadline or forge its response',()=>{
  assert.throws(()=>verifyBettingTranscript({...deal,actions:[
    {...legal(1,0,'timeout',0),deadline:101,timestamp:101,move:'fold'}
  ]}));
  assert.throws(()=>verifyBettingTranscript({...deal,actions:[
    {...legal(1,0,'timeout',0),deadline:99,timestamp:100,move:'check'}
  ]}));
  const expired=verifyBettingTranscript({...deal,actions:[
    {...legal(1,0,'timeout',0),deadline:99,timestamp:100,move:'fold'}
  ]});
  assert.equal(expired.phase,'UNCONTESTED');
  assert.equal(expired.nonce,1);
});
test('reveal requires an authenticated final-root-matched street transition',()=>{
  const actions=[legal(1,0,'call',5),legal(2,1,'check')];
  assert.throws(()=>verifyBettingTranscript({...deal,actions:[
    ...actions,{type:'reveal',from:'AWAIT_TURN',to:'TURN',accepted:true,finalRootMatched:true}
  ]}));
  assert.throws(()=>verifyBettingTranscript({...deal,actions:[
    ...actions,{type:'reveal',from:'AWAIT_FLOP',to:'FLOP',accepted:true,finalRootMatched:false}
  ]}));
  const game=verifyBettingTranscript({...deal,actions:[
    ...actions,{type:'reveal',from:'AWAIT_FLOP',to:'FLOP',accepted:true,finalRootMatched:true},
    legal(3,1,'check'),legal(4,0,'check')
  ]});
  assert.equal(game.phase,'AWAIT_TURN');
});
test('full nine-way ranked side pots: only covered live players eligible and chips conserved',()=>{
  const board=[1,2,3,4,5];
  const contributions=[10,20,30,40,50,60,70,80,90];
  const holeCards=[[12,25],[11,24],[10,23],[9,22],[8,21],[7,20],[6,19],[17,30],[18,31]];
  const folded=[false,true,false,false,true,false,false,false,false];
  const answer=verifyShowdownSettlement({contributions,folded,holeCards,board,button:3,rake:10});
  assert.equal(answer.payouts.reduce((a,b)=>a+b,0)+answer.fee,450);
  assert.equal(answer.refund,10);
  assert.equal(answer.payouts[1],0);
  assert.equal(answer.payouts[4],0);
  assert.equal(answer.tiers.length,8);
});
test('tie on board returns odd chips clockwise from button, not at dealer discretion',()=>{
  const board=[1,2,3,4,5]; // one shared five-high straight
  const holeCards=[[15,28],[16,29],[17,30]];
  const got=verifyShowdownSettlement({
    contributions:[5,5,5],folded:[false,false,true],holeCards,board,button:0,rake:0
  });
  assert.deepEqual(got.payouts,[7,8,0]);
});
test('invalid card identity, missing ranking, adversarial rake and zero-survivor side pots fail closed',()=>{
  const b=[1,2,3,4,5];
  assert.throws(()=>verifyShowdownSettlement({contributions:[10,10],folded:[false,false],
    holeCards:[[1,6],[7,8]],board:b,button:0}));
  assert.throws(()=>verifyShowdownSettlement({contributions:[10,10],folded:[false,false],
    holeCards:[[6,7],[8,9]],board:b,button:0,rake:21}));
  assert.throws(()=>verifyShowdownSettlement({contributions:[10,20],folded:[true,true],
    holeCards:[null,null],board:b,button:0,rake:0}));
});
