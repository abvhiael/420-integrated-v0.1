import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyBettingTranscript,verifyShowdownSettlement} from './nlhe-independent-verifier.mjs';
import {settleWithRake} from './nlhe-economics.mjs';
import {rank7} from './nlhe-replay.mjs';
function session(n,button){
 const stacks=Array(n).fill(400),sb=n===2?button:(button+1)%n,bb=(sb+1)%n,first=n===2?button:(bb+1)%n,actions=[];
 for(let k=0;k<n;k++){const seat=(first+k)%n,paid=seat===sb?10:seat===bb?20:0;actions.push({nonce:k+1,seat,type:k===0?'raise':'call',amount:400-paid,epochCurrent:true,stateRootMatched:true,signed:true,signatureMatchesSeat:true,actionAuthorized:true,expiry:1700000050,timestamp:1700000000});}
 actions.push(...[['AWAIT_FLOP','FLOP'],['AWAIT_TURN','TURN'],['AWAIT_RIVER','RIVER']].map(([from,to])=>({type:'reveal',from,to,accepted:true,finalRootMatched:true})));
 return {stacks,button,smallBlind:10,bigBlind:20,actions};
}
for(let n=2;n<=9;n++)test(`5A10 differential all-in runout and side pots for ${n} players at every button`,()=>{
 for(let button=0;button<n;button++){
  const data=session(n,button),r=verifyBettingTranscript(data);assert.equal(r.phase,'SHOWDOWN');assert.equal(r.pot,400*n);assert(r.seats.every(p=>p.allIn));
  const hole=Array.from({length:n},()=>[]),first=n===2?button:(button+1)%n;for(let pos=0;pos<2*n;pos++)hole[(first+pos%n)%n].push(pos);
  const board=[2*n+1,2*n+2,2*n+3,2*n+5,2*n+7],contributions=Array.from({length:n},(_,i)=>20+20*i),folded=Array(n).fill(false),ranks=hole.map(x=>rank7([...x,...board]));
  const expected=settleWithRake({contributions,folded,ranks,button,flopSeen:true,rakeBps:500,rakeCap:20}),other=verifyShowdownSettlement({contributions,folded,holeCards:hole,board,button,rake:expected.rake});
  assert.deepEqual(other.payouts,expected.payouts);assert.equal(other.refund,20);assert.equal(other.tiers.length,n-1);
 }
});
for(const [name,alter] of [
 ['forged current actor',d=>d.actions[0].signatureMatchesSeat=false],
 ['revoked player',d=>d.actions[0].actionAuthorized=false],
 ['stale seating epoch',d=>d.actions[0].epochCurrent=false],
 ['forked state root',d=>d.actions[0].stateRootMatched=false],
 ['reordered multiplayer action',d=>[d.actions[0],d.actions[1]]=[d.actions[1],d.actions[0]]],
 ['duplicate action replay',d=>d.actions.splice(1,0,structuredClone(d.actions[0]))],
 ['invalid final reveal',d=>d.actions.at(-1).finalRootMatched=false],
 ['out of stack raise',d=>d.actions[0].amount=401],
])test('5A10 nine-client replay rejects '+name,()=>{const d=session(9,0);alter(d);assert.throws(()=>verifyBettingTranscript(d));});
