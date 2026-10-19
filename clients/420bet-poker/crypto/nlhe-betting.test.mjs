import test from 'node:test';
import assert from 'node:assert/strict';
import {replayBetting} from './nlhe-betting.mjs';
const a=(nonce,street,seat,type,amount=0)=>({nonce,street,seat,type,amount});
test('three-handed preflop and flop action cycles with conservation',()=>{
 const x=replayBetting({stacks:[100,100,100],button:0,smallBlind:5,bigBlind:10,actions:[
 a(1,0,0,'call',10),a(2,0,1,'call',5),a(3,0,2,'check'),
 a(4,1,1,'check'),a(5,1,2,'check'),a(6,1,0,'check'),
 a(7,2,1,'check'),a(8,2,2,'check'),a(9,2,0,'check'),
 a(10,3,1,'check'),a(11,3,2,'check'),a(12,3,0,'check')
 ]});
 assert.equal(x.bettingComplete,true);
 assert.deepEqual(x.committed,[10,10,10]);
 assert.equal(x.totalCommitted+x.totalRemaining,300);
});
test('heads up button small blind acts first preflop and second postflop',()=>{
 const x=replayBetting({stacks:[100,100],button:0,smallBlind:5,bigBlind:10,actions:[
 a(1,0,0,'call',5),a(2,0,1,'check'),
 a(3,1,1,'check'),a(4,1,0,'check')
 ]});
 assert.equal(x.street,2);assert.deepEqual(x.committed,[10,10]);
});
test('raise resets pending responses and changes minimum full raise',()=>{
 const x=replayBetting({stacks:[100,100,100],button:0,smallBlind:5,bigBlind:10,actions:[
 a(1,0,0,'raise',30),a(2,0,1,'call',25),a(3,0,2,'call',20)
 ]});
 assert.equal(x.street,1);assert.deepEqual(x.committed,[30,30,30]);
});
test('short all-in raise does not reopen original raiser',()=>{
 const x={stacks:[100,15,100],button:0,smallBlind:5,bigBlind:10,actions:[
 a(1,0,0,'call',10),a(2,0,1,'raise',10),a(3,0,2,'call',5),
 a(4,0,0,'raise',10)
 ]};
 assert.throws(()=>replayBetting(x),/betting not reopened/);
});
test('repeated/unsigned-equivalent actions and out-of-order streets fail',()=>{
 assert.throws(()=>replayBetting({stacks:[100,100,100],button:0,smallBlind:5,bigBlind:10,
 actions:[a(2,0,0,'call',10)]}),/wrong nonce/);
 assert.throws(()=>replayBetting({stacks:[100,100,100],button:0,smallBlind:5,bigBlind:10,
 actions:[a(1,1,0,'call',10)]}),/wrong nonce/);
});
test('blind and ante amounts stay conserved, ante does not count as a call',()=>{
 const x=replayBetting({stacks:[100,100,100],button:0,smallBlind:5,bigBlind:10,ante:2,
 actions:[a(1,0,0,'call',10),a(2,0,1,'call',5),a(3,0,2,'check')]});
 assert.deepEqual(x.committed,[12,12,12]);
});

test('two cumulative short all-ins reopen only at full raise increment',()=>{
 const result=replayBetting({stacks:[1000,30,40,25],button:0,smallBlind:5,bigBlind:10,actions:[
  a(1,0,3,'raise',25),
  a(2,0,0,'call',25),
  a(3,0,1,'raise',25),
  a(4,0,2,'raise',30),
  a(5,0,0,'raise',50)
 ]});
 assert.equal(result.contributed[0],75);
 assert.equal(result.nonce,5);
});
test('one short all-in does not reopen previously acting player',()=>{
 assert.throws(()=>replayBetting({stacks:[1000,30,1000,25],button:0,smallBlind:5,bigBlind:10,actions:[
  a(1,0,3,'raise',25),a(2,0,0,'call',25),
  a(3,0,1,'raise',25),a(4,0,2,'call',20),
  a(5,0,0,'raise',30)
 ]}),/betting not reopened/);
});
