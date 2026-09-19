import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyApiFailure, focusAfterRender, loadingCopy, onlineState, responsiveTableLabel } from '../core/reliability.js';

test('API 429 and 503 are retryable degraded states',()=>{
  assert.deepEqual(classifyApiFailure({code:'RATE_LIMITED',status:429}),{state:'degraded',retryable:true,message:'Exchange API rate limited'});
  assert.deepEqual(classifyApiFailure({status:503}),{state:'degraded',retryable:true,message:'Exchange API temporarily unavailable'});
});

test('version mismatch is blocked and not retryable',()=>{
  assert.deepEqual(classifyApiFailure({code:'UNSUPPORTED_VERSION',status:406}),{state:'blocked',retryable:false,message:'Exchange API version mismatch'});
});

test('loading copy is explicit by surface',()=>{
  assert.equal(loadingCopy('portfolio'),'Loading portfolio…');
  assert.equal(loadingCopy('unknown'),'Loading Exchange data…');
});

test('responsive table labels preserve header/value semantics',()=>{
  assert.deepEqual(responsiveTableLabel('Amount',42),{header:'Amount',value:'42'});
  assert.deepEqual(responsiveTableLabel('Amount',null),{header:'Amount',value:'—'});
});

test('focus restoration is explicit and safe',()=>{
  let focused=false;
  const documentRef={getElementById:(id)=>id==='target'?{focus:()=>{focused=true;}}:null};
  assert.equal(focusAfterRender({previousId:'target',documentRef}),true);
  assert.equal(focused,true);
  assert.equal(focusAfterRender({previousId:'missing',documentRef}),false);
});

test('online state is deterministic',()=>{
  assert.equal(onlineState(false),'offline');
  assert.equal(onlineState(true),'online');
});
