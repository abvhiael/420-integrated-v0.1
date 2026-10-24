import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyBettingTranscript as verify} from './nlhe-independent-verifier.mjs';
import {replayBetting as replay} from './nlhe-betting.mjs';

const base={stacks:[400,400],button:0,smallBlind:10,bigBlind:20};
const signed=(nonce,seat,type,amount=0,timestamp=100)=>({nonce,seat,type,amount,timestamp,
  epochCurrent:true,stateRootMatched:true,signed:true,signatureMatchesSeat:true,actionAuthorized:true,expiry:10000});
const reveal=(from,to,timestamp=100)=>({type:'reveal',from,to,timestamp,accepted:true,finalRootMatched:true});

test('5A5 exact deadline belongs to action; timeout requires the canonical deadline',()=>{
  const config={...base,startTimestamp:100};
  assert.equal(verify({...config,actions:[signed(1,0,'call',10,160)]}).turnDeadline,220);
  assert.throws(()=>verify({...config,actions:[signed(1,0,'call',10,161)]}),/expired turn/);
  for(const [deadline,timestamp] of [[160,160],[159,161],[161,162]])
    assert.throws(()=>verify({...config,actions:[{...signed(1,0,'timeout',0,timestamp),deadline,move:'fold'}]}));
  assert.equal(verify({...config,actions:[{...signed(1,0,'timeout',0,161),deadline:160,move:'fold'}]}).phase,'UNCONTESTED');
});

test('5A5 old deadline cannot expire next actor and timestamps cannot go backward',()=>{
  const first=signed(1,0,'call',10,150);
  assert.throws(()=>verify({...base,startTimestamp:100,actions:[first,
    {...signed(2,1,'timeout',0,211),deadline:160,move:'check'}]}),/forged turn deadline/);
  assert.throws(()=>verify({...base,startTimestamp:100,actions:[first,signed(2,1,'check',0,149)]}),/timestamp/);
  const next=verify({...base,startTimestamp:100,actions:[first,
    {...signed(2,1,'timeout',0,211),deadline:210,move:'check'}]});
  assert.equal(next.phase,'AWAIT_FLOP');assert.equal(next.turnDeadline,null);
  assert.equal(next.timingVerified,true);
});

test('5A5 signed action capability is independently enforced',()=>{
  assert.throws(()=>verify({...base,actions:[{...signed(1,0,'call',10),actionAuthorized:false}]}),/revoked/);
  assert.throws(()=>verify({...base,actions:[{...signed(1,0,'call',10),actionAuthorized:undefined}]}),/missing/);
  assert.equal(verify({...base,actions:[]}).timingVerified,false);
});

test('5A5 actual short blind is the lone opponent call; no empty side pot raise',()=>{
  const config={...base,stacks:[400,15]};
  assert.throws(()=>verify({...config,actions:[signed(1,0,'call',10)]}),/bad call/);
  assert.throws(()=>verify({...config,actions:[signed(1,0,'raise',30)]}),/no opponent/);
  const result=verify({...config,actions:[signed(1,0,'call',5)]});
  assert.equal(result.pot,30);assert.equal(result.phase,'AWAIT_FLOP');
  const model=replay({...config,actions:[{nonce:1,street:0,seat:0,type:'call',amount:5}]});
  assert.equal(model.totalCommitted,30);assert.equal(model.bettingComplete,true);
  assert.throws(()=>replay({...config,actions:[{nonce:1,street:0,seat:0,type:'raise',amount:30}]}),/no live opponent/);
});

test('5A5 all-in runout requires each authenticated reveal and no betting moves',()=>{
  const actions=[signed(1,0,'raise',390),signed(2,1,'call',380)];
  assert.equal(verify({...base,actions}).phase,'AWAIT_FLOP');
  actions.push(reveal('AWAIT_FLOP','FLOP'),reveal('AWAIT_TURN','TURN'),reveal('AWAIT_RIVER','RIVER'));
  const final=verify({...base,actions});assert.equal(final.phase,'SHOWDOWN');assert.equal(final.toAct,-1);
  assert.equal(final.pot,800);assert.equal(final.nonce,2);
  assert.throws(()=>verify({...base,actions:[...actions,signed(3,0,'check')]}),/terminal/);
  assert.throws(()=>verify({...base,actions:[...actions.slice(0,2),reveal('AWAIT_TURN','TURN')]}),/premature/);
});

test('5A5 independent models agree on short blinds and calls for 2–9 seats and every button',()=>{
  for(let n=2;n<=9;n++)for(let button=0;button<n;button++)for(let short=1;short<=24;short++){
    const stacks=Array(n).fill(400);stacks[(button+(n===2?1:2))%n]=short;
    const config={stacks,button,smallBlind:10,bigBlind:20};const actions=[];
    let actual=verify({...config,actions});
    while(actual.phase==='PREFLOP'){
      const p=actual.seats[actual.toAct],owed=Math.max(0,actual.currentBet-p.bet);
      actions.push(signed(actions.length+1,p.seat,owed?'call':'check',Math.min(owed,p.stack)));
      actual=verify({...config,actions});
    }
    const other=replay({...config,actions:actions.map(x=>({...x,street:0}))});
    assert.deepEqual(other.committed,actual.seats.map(x=>x.contributed));
    assert.deepEqual(other.remaining,actual.seats.map(x=>x.stack));
    assert.equal(other.nonce,actual.nonce);assert.equal(other.totalCommitted,actual.pot);
  }
});

test('5A5 trailing actions after a folded or all-in terminal cannot be ignored',()=>{
  assert.throws(()=>replay({...base,actions:[
    {nonce:1,street:0,seat:0,type:'fold'}, {nonce:2,street:0,seat:1,type:'check'}]}),/already won/);
  assert.throws(()=>replay({...base,stacks:[1,2],actions:[{nonce:1,street:0,seat:0,type:'check'}]}),/closed/);
});
