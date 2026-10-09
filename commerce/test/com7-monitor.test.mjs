import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCommerceHealth,checkCommerceHealth} from '../src/monitor.mjs';
const envelope={schema:'420-commerce-api-v1',data:{authoritative:false,chainId:'420',height:120,finalizedHeight:119,updatedAt:100000,state:'ready'}};
test('COM-7 health monitor accepts only verified ready, current service state without telemetry secrets',()=>{
 assert.deepEqual(validateCommerceHealth(envelope,{chainId:'420',now:100100}),{state:'ready',chainId:'420',height:120,finalizedHeight:119});
 const changes=[
  {state:'halted'},{state:'stale'},{chainId:'421'},{authoritative:true},
  {updatedAt:1},{updatedAt:120000},{finalizedHeight:121},
  {finalizedHeight:0},{height:120.5}
 ];
 for(const update of changes)assert.throws(()=>validateCommerceHealth({schema:'420-commerce-api-v1',data:{...envelope.data,...update}},{chainId:'420',now:100100,maxUnfinalizedBlocks:64}));
 assert.throws(()=>validateCommerceHealth({data:envelope.data},{chainId:'420',now:100100}));
});
test('COM-7 monitor refuses insecure origin, redirects and failed health responses',async()=>{
 const healthy=async()=>({ok:true,json:async()=>envelope});
 assert.deepEqual(await checkCommerceHealth({endpoint:'https://commerce.example.invalid/v1/health',chainId:'420',now:100100,fetcher:healthy}),{state:'ready',chainId:'420',height:120,finalizedHeight:119});
 await assert.rejects(()=>checkCommerceHealth({endpoint:'http://evil.invalid/v1/health',chainId:'420',fetcher:healthy}),/monitor_insecure_origin/);
 await assert.rejects(()=>checkCommerceHealth({endpoint:'https://commerce.example.invalid/v1/health?token=x',chainId:'420',fetcher:healthy}),/monitor_invalid_url/);
 await assert.rejects(()=>checkCommerceHealth({endpoint:'https://commerce.example.invalid/v1/health',chainId:'420',fetcher:async()=>({ok:false})}),/health_http_failure/);
});
