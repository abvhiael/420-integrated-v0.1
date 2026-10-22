import test from 'node:test';
import assert from 'node:assert/strict';
import {returnUncalled,canonicalRake,settleWithRake} from './nlhe-economics.mjs';
test('uncalled overbet is returned rather than awarded',()=>{
 const x=returnUncalled([100,50,10],[false,false,true]);
 assert.deepEqual(x.contributions,[50,50,10]);
 assert.deepEqual(x.refunds,[50,0,0]);
});
test('rake bounded and no-flop-no-drop policy',()=>{
 assert.equal(canonicalRake({grossPot:1000,flopSeen:false,bps:500,cap:20}),0);
 assert.equal(canonicalRake({grossPot:1000,flopSeen:true,bps:500,cap:20}),20);
 assert.equal(canonicalRake({grossPot:1000,flopSeen:true,bps:100,cap:20}),10);
 assert.throws(()=>canonicalRake({grossPot:1000,flopSeen:true,bps:10001,cap:20}));
});
test('side-pot rake, uncalled refunds and net payouts conserve total',()=>{
 const p=settleWithRake({contributions:[100,50,10],folded:[false,false,true],
   ranks:[[2,12],[1,14],null],button:0,flopSeen:true,rakeBps:500,rakeCap:100});
 assert.deepEqual(p.refunds,[50,0,0]);
 assert.equal(p.rake,5);
 assert.equal(p.payouts.reduce((a,b)=>a+b)+p.rake,160);
});
test('ties receive odd chips deterministically',()=>{
 const p=settleWithRake({contributions:[5,5,5],folded:[false,false,true],
   ranks:[[2,10],[2,10],null],button:0,flopSeen:false,rakeBps:500,rakeCap:10});
 assert.deepEqual(p.payouts,[7,8,0]);
});
