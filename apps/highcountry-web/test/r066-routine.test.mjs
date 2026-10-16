import test from 'node:test';import assert from 'node:assert/strict';
import {createHighCountryRoutineClient420} from '../src/routine.js';
test('authenticated routine requires no wallet and includes no caller-selected principal',async()=>{
 let sent;const c=createHighCountryRoutineClient420({apiUrl:'https://api.example',authenticate:async()=>'issuer-token',
  fetchImpl:async(url,opts)=>{sent=JSON.parse(opts.body);assert.equal(opts.headers.authorization,'Bearer issuer-token');
   return {ok:true,json:async()=>({ok:true,result:{accepted:true}})};}});
 assert.equal((await c.invoke({sessionId:'session1',action:'approved',operation:'o1'})).accepted,true);
 assert.equal(Object.hasOwn(sent,'principal'),false);assert.equal(sent.escalation,null);
});
test('sensitive action cannot bypass escalation and unauthorized identity fails closed',async()=>{
 let count=0;const c=createHighCountryRoutineClient420({apiUrl:'https://api.example',authenticate:async()=>'auth',
  fetchImpl:async()=>{count++;return {ok:true,json:async()=>({ok:true,result:true})};}});
 await assert.rejects(c.invoke({sessionId:'s',action:'pay',operation:'op',sensitive:true}),/r066-escalation-unavailable/);
 assert.equal(count,0);
 const d=createHighCountryRoutineClient420({apiUrl:'https://api.example',authenticate:async()=>'',
  fetchImpl:async()=>{count++;return {ok:true};}});
 await assert.rejects(d.invoke({sessionId:'s',action:'read',operation:'op'}),/r066-auth-required/);
 assert.equal(count,0);
});
test('server denial never converts to allowed client state',async()=>{
 const c=createHighCountryRoutineClient420({apiUrl:'https://api.example',authenticate:async()=>'auth',
 fetchImpl:async()=>({ok:false,status:403})});
 await assert.rejects(c.invoke({sessionId:'s',action:'read',operation:'op'}),/r066-authority-denied/);
});
