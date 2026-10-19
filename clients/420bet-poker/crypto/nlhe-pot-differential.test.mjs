import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceAward} from './nlhe-pot-reference.mjs';
import {settleWithRake} from './nlhe-economics.mjs';
let state=0x42005;
function rnd(n){state=(Math.imul(state,1664525)+1013904223)>>>0;return state%n;}
test('independent per-chip pot oracle agrees across 1000 no-rake scenarios',()=>{
 for(let k=0;k<1000;k++){
  const n=2+rnd(5),button=rnd(n);
  const contributions=Array.from({length:n},()=>1+rnd(40));
  const folded=Array.from({length:n},()=>rnd(3)===0);
  // Retain a live top contributor; an unmatched folded top stack is not\n  // a reachable, contested terminal poker pot.\n  folded[contributions.indexOf(Math.max(...contributions))]=false;
  // Some arbitrary but consistently ranked showdown hands.
  const ranks=Array.from({length:n},()=>[rnd(8),rnd(15),rnd(15)]);
  const data={contributions,folded,ranks,button};
  const expected=referenceAward(data);
  const actual=settleWithRake({...data,flopSeen:false,rakeBps:0,rakeCap:0}).payouts;
  assert.deepEqual(actual,expected,JSON.stringify({k,...data}));
 }
});
