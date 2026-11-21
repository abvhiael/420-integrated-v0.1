import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../core/app.mjs';
test('canonical RPC and Registry failures return sanitized 503 without leaking upstream secrets',async()=>{
  const rpc={call:async()=>{throw Error('sensitive private RPC credential and internal path');}};
  const app=createApp({rpc,projection:{}});
  const response=await app({method:'GET',path:'/v1/launchpad/runtime'});
  assert.equal(response.status,503);
  assert.equal(response.body.error,'Launchpad canonical service temporarily unavailable');
  assert.doesNotMatch(JSON.stringify(response),/credential|internal path/);
});
