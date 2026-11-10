import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,next} from '../src/practice-engine.js';
import {initialRacketSession,settleRacketRoll,racketWinProbability,racketPotentialPayoutCents,RACKET_START_CENTS,RACKET_STAKE_CENTS} from '../src/racket-double-trouble.js';

test('virtual session starts with 1000 credits and the 10 credit fixed practice stake',()=>{
 assert.equal(RACKET_START_CENTS,100000);
 assert.equal(RACKET_STAKE_CENTS,1000);
 assert.deepEqual(initialRacketSession(),{balanceCents:100000,charge:0,lastPayoutCents:0,lastNetCents:0,lastBonus:false,lastWin:false,rounds:0});
});

test('win probabilities and ordinary payout math are computed from exact threshold',()=>{
 assert.equal(racketWinProbability('under',5000),.5);
 assert.equal(racketWinProbability('over',4200),.58);
 assert.equal(racketPotentialPayoutCents('under',5000),1920);
 assert.equal(racketPotentialPayoutCents('over',4200,true),3310);
 for(const n of [1,420,5000,9999])for(const side of ['under','over']){
  assert.equal(racketPotentialPayoutCents(side,n,true),racketPotentialPayoutCents(side,n,false)*2);
 }
});

test('ten percent base charge plus five percent for a winning round, no premature bonus',()=>{
 let s=initialRacketSession();
 s=settleRacketRoll(s,{roll:2000,choice:'under',threshold:5000});
 assert.equal(s.charge,15);
 assert.equal(s.balanceCents,100920);
 assert.equal(s.lastPayoutCents,1920);
 assert.equal(s.lastBonus,false);
 s=settleRacketRoll(s,{roll:8000,choice:'under',threshold:5000});
 assert.equal(s.charge,25);
 assert.equal(s.balanceCents,99920);
 assert.equal(s.lastPayoutCents,0);
});

test('100 percent charge arms the NEXT roll, pays twice only when that next roll wins, then resets',()=>{
 let s=initialRacketSession();
 for(let i=0;i<7;i++)s=settleRacketRoll(s,{roll:0,choice:'under',threshold:5000});
 assert.equal(s.charge,100);
 assert.equal(s.lastBonus,false);
 const before=s.balanceCents;
 s=settleRacketRoll(s,{roll:0,choice:'under',threshold:5000});
 assert.equal(s.lastBonus,true);
 assert.equal(s.lastWin,true);
 assert.equal(s.lastPayoutCents,3840);
 assert.equal(s.balanceCents,before-1000+3840);
 assert.equal(s.charge,0);
 s=settleRacketRoll(s,{roll:0,choice:'under',threshold:5000});
 assert.equal(s.lastBonus,false);
 assert.equal(s.lastPayoutCents,1920);
 assert.equal(s.charge,15);
});

test('a losing next roll consumes Double Trouble without giving a payout or rolling charge forward',()=>{
 let s=initialRacketSession();
 for(let i=0;i<10;i++)s=settleRacketRoll(s,{roll:9999,choice:'under',threshold:5000});
 assert.equal(s.charge,100);
 s=settleRacketRoll(s,{roll:9999,choice:'under',threshold:5000});
 assert.equal(s.lastBonus,true);
 assert.equal(s.lastWin,false);
 assert.equal(s.lastPayoutCents,0);
 assert.equal(s.charge,0);
});

test('bonus cannot change the 0–9999 practice-engine boundaries or actual roll',()=>{
 for(const threshold of [1,420,5000,9999])for(const choice of ['under','over']){
  const setup=next(next(initial('dice'),{type:'threshold',value:threshold}),{type:'choice',value:choice});
  for(const roll of [0,threshold-1,threshold,9999]){
   const after=next(setup,{type:'play'},()=>roll/10000);
   const virtual=settleRacketRoll({...initialRacketSession(),charge:100},{roll:after.result[0],choice,threshold});
   assert.equal(after.result[0],roll);
   assert.equal(virtual.lastWin,choice==='under'?roll<threshold:roll>=threshold);
   assert.equal(virtual.lastBonus,true);
  }
 }
});

test('insufficient virtual balance blocks rolls and cannot go negative',()=>{
 const s={...initialRacketSession(),balanceCents:999};
 assert.throws(()=>settleRacketRoll(s,{roll:0,choice:'under',threshold:5000}),/not enough virtual credits/);
 assert.equal(s.balanceCents,999);
});
