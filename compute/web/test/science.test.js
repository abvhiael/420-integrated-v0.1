import test from 'node:test';import assert from 'node:assert/strict';import {normalizeScienceObservations420} from '../core/science.js';
const time=1760000000000;
const x={schemaVersion:'420-science-read-v1',chainId:'420',authoritative:false,rewardEligible:false,items:[{chainId:'420',provider:'BOINC',workKey:'a'.repeat(64),project:'project',creditUnit:'BOINC_CREDIT',creditedEvent:'20',eligibility:'UNVERIFIED',finality:'UNFINALIZED',observedAt:time-500,stale:false,authoritative:false,rewardEligible:false,amount420:null}]};
test('unverified credits cannot become monetary balances',()=>{let rows=normalizeScienceObservations420(x,{chainId:'420',now:time});assert.equal(rows[0].reward,'No $420 entitlement');assert.equal(rows[0].status,'UNVERIFIED')});
test('wrong chain and falsely authoritative projections fail',()=>{assert.throws(()=>normalizeScienceObservations420({...x,chainId:'1'},{chainId:'420'}));assert.throws(()=>normalizeScienceObservations420({...x,items:[{...x.items[0],amount420:'100'}]},{chainId:'420'}))});
test('stale data visible as stale',()=>assert.equal(normalizeScienceObservations420(x,{chainId:'420',now:time+90000000})[0].status,'STALE'));
