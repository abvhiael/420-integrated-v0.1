import test from 'node:test';import assert from 'node:assert/strict';
import {createHighCountryRoutineAuthority420} from '../src/highcountry-r066-routine-authority.js';
const base={token:'t',sessionId:'session1',action:'routine1',operation:'o1',body:{}};
function setup(){let valid=true,expiry=1000,now=20,steps=0,escalate=false;
 const authority=createHighCountryRoutineAuthority420({
  verifyIdentity:async t=>t==='t'?'user1':null,
  verifySession:async()=>({active:valid,revoked:!valid,principal:'user1',sessionId:'session1',expiresAt:expiry,actions:['routine1','sensitive1']}),
  verifyEscalation:async()=>escalate,clock:()=>now,
  operationJournal:{claim:async()=>true},approvedActions:{routine1:{classification:'routine',value:0,execute:async()=>{steps++;return {accepted:true};}},
   sensitive1:{classification:'sensitive',value:1,execute:async()=>{steps++;return {accepted:true};}}}});
 return {authority,setValid:x=>valid=x,setExpiry:x=>expiry=x,setNow:x=>now=x,setEscalate:x=>escalate=x,steps:()=>steps};}
test('approved zero-value routine action, rejected unreviewed action and session expiry',async()=>{
 const v=setup();assert.equal((await v.authority.invoke(base)).accepted,true);
 await assert.rejects(v.authority.invoke({...base,action:'other'}),/r066-request-denied/);
 v.setNow(1000);await assert.rejects(v.authority.invoke(base),/r066-session-invalid/);
 assert.equal(v.steps(),1);
});
test('revocation fails closed and sensitive action requires verified escalation',async()=>{
 const v=setup();v.setValid(false);await assert.rejects(v.authority.invoke(base),/r066-session-invalid/);
 v.setValid(true);
 await assert.rejects(v.authority.invoke({...base,action:'sensitive1'}),/r066-sensitive-escalation-required/);
 await assert.rejects(v.authority.invoke({...base,action:'sensitive1',escalation:{kind:'wallet'}}),/r066-sensitive-escalation-required/);
 v.setEscalate(true);assert.equal((await v.authority.invoke({...base,action:'sensitive1',escalation:{kind:'passkey'}})).accepted,true);
 assert.equal(v.steps(),1);
});
test('policy cannot authorize positive-value routine action',()=>{
 assert.throws(()=>createHighCountryRoutineAuthority420({verifyIdentity:async()=>{},verifySession:async()=>{},
 verifyEscalation:async()=>{},operationJournal:{claim:async()=>true},approvedActions:{a:{classification:'routine',value:1,execute:async()=>{}}}}),/r066-policy-invalid/);
});
