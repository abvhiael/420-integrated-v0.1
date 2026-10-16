import test from 'node:test';import assert from 'node:assert/strict';
import {createHighCountryRoutineAuthority420} from '../src/highcountry-r066-routine-authority.js';
test('midflight revocation aborts prior to executing and cannot transfer authority',async()=>{
 let checks=0,execute=0;
 const authority=createHighCountryRoutineAuthority420({
  verifyIdentity:async()=> 'principal1',
  verifySession:async()=>{checks++;return {active:checks===1,revoked:checks!==1,
   expiresAt:1000,principal:'principal1',sessionId:'s',actions:['zero']};},
  verifyEscalation:async()=>false,clock:()=>1,
  operationJournal:{claim:async()=>true},approvedActions:{zero:{classification:'routine',value:0,execute:async()=>{execute++;return true;}}}});
 await assert.rejects(authority.invoke({token:'t',sessionId:'s',action:'zero',operation:'one'}),/r066-session-revoked/);
 assert.equal(execute,0);assert.equal(checks,2);
});
test('concurrent duplicate operations deny before execute',async()=>{
 let release;const blocker=new Promise(resolve=>release=resolve);let entered=0;
 const authority=createHighCountryRoutineAuthority420({
 verifyIdentity:async()=> 'p',
 verifySession:async()=>({active:true,revoked:false,expiresAt:1000,principal:'p',sessionId:'s',actions:['zero']}),
 verifyEscalation:async()=>false,clock:()=>1,
 operationJournal:{claim:async()=>true},approvedActions:{zero:{classification:'routine',value:0,execute:async()=>{entered++;await blocker;return true;}}}});
 const x={token:'t',sessionId:'s',action:'zero',operation:'same'};
 const first=authority.invoke(x);
 // Ensure the first call has acquired the same-operation lock before issuing the duplicate.
 await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(authority.invoke(x),/r066-duplicate-operation/);
 release();assert.equal(await first,true);assert.equal(entered,1);
});

test('issuer revocation between validation and execution fails closed',async()=>{
 let authCount=0,executed=0;
 const authority=createHighCountryRoutineAuthority420({
  verifyIdentity:async()=>++authCount===1?'p':null,
  verifySession:async()=>({active:true,revoked:false,expiresAt:1000,principal:'p',sessionId:'s',actions:['zero']}),
  verifyEscalation:async()=>false,operationJournal:{claim:async()=>true},clock:()=>1,
  approvedActions:{zero:{classification:'routine',value:0,execute:async()=>{executed++;return true;}}}});
 await assert.rejects(authority.invoke({token:'t',sessionId:'s',action:'zero',operation:'o'}),/r066-identity-revoked/);
 assert.equal(executed,0);assert.equal(authCount,2);
});
test('expired or malformed second session grant cannot execute',async()=>{
 let call=0,executed=0;
 const authority=createHighCountryRoutineAuthority420({
  verifyIdentity:async()=> 'p',
  verifySession:async()=>({active:true,revoked:false,expiresAt:++call===1?1000:'bad',
   principal:'p',sessionId:'s',actions:['zero']}),
  verifyEscalation:async()=>false,operationJournal:{claim:async()=>true},clock:()=>1,
  approvedActions:{zero:{classification:'routine',value:0,execute:async()=>{executed++;return true;}}}});
 await assert.rejects(authority.invoke({token:'t',sessionId:'s',action:'zero',operation:'o'}),/r066-session-revoked/);
 assert.equal(executed,0);
});
